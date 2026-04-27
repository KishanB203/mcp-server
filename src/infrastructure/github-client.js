/**
 * @module infrastructure/github-client
 *
 * GitHub REST API v3 client built on Axios.
 * Supports branch creation, pull-request lifecycle (create / comment / merge),
 * and PR listing.
 *
 * Usage:
 *   import { createGitHubClient } from "../../infrastructure/github-client.js";
 *   const github = createGitHubClient();
 *   await github.createBranch(repo, "main", "feature/123-my-feature");
 */

import axios from "axios";
import {
  GITHUB_TOKEN,
  GITHUB_API_BASE_URL,
  GITHUB_API_VERSION,
  REPO_OWNER,
  REPO_NAME,
} from "../config/env.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Throws a descriptive error when a required env var is absent.
 * @param {string} name
 * @param {string|undefined} value
 */
const requireEnv = (name, value) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

/**
 * Normalises a repo argument into `{ owner, name }`.
 * Accepts:
 *   - `{ owner, name }` object (preferred)
 *   - `"owner/name"` string
 *   - `undefined` → falls back to REPO_OWNER / REPO_NAME env vars
 *
 * @param {string|{owner:string,name:string}|undefined} repo
 * @returns {{ owner: string, name: string }}
 */
const normalizeRepo = (repo) => {
  if (!repo) {
    if (REPO_OWNER && REPO_NAME) return { owner: REPO_OWNER, name: REPO_NAME };
    throw new Error(
      `Repo not specified. Pass { owner, name } or set REPO_OWNER and REPO_NAME in .env`
    );
  }

  if (typeof repo === "string") {
    const [owner, name] = repo.split("/");
    if (!owner || !name) {
      throw new Error(`Invalid repo string "${repo}". Expected "owner/name".`);
    }
    return { owner, name };
  }

  const owner = repo.owner ?? repo.REPO_OWNER;
  const name = repo.name ?? repo.repo ?? repo.REPO_NAME;
  if (!owner || !name) {
    throw new Error(`Invalid repo object. Expected { owner, name }.`);
  }
  return { owner, name };
}

/** Returns the standard GitHub API request headers. */
const buildHeaders = () => {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "Content-Type": "application/json",
    "User-Agent": "mcp-automation/2.0.0",
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return headers;
}

// ─────────────────────────────────────────────────────────────────────────────
// GitHubClient
// ─────────────────────────────────────────────────────────────────────────────

export class GitHubClient {
  /**
   * @param {{ baseUrl?: string }} [options]
   */
  constructor({ baseUrl = GITHUB_API_BASE_URL } = {}) {
    this.http = axios.create({
      baseURL: baseUrl,
      headers: buildHeaders(),
      timeout: 30_000,
    });
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Resolves the SHA of a branch ref.
   * @param {{ owner: string, name: string }} repo
   * @param {string} ref  e.g. "heads/main"
   * @returns {Promise<string>} commit SHA
   */
  async _getRefSha({ owner, name }, ref) {
    const r = await this.http.get(`/repos/${owner}/${name}/git/ref/${ref}`);
    return r.data?.object?.sha;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Creates a remote branch pointing at the HEAD of `baseBranch`.
   * If the branch already exists the call is treated as a no-op.
   *
   * @param {string|{owner:string,name:string}} repo
   * @param {string} baseBranch  Source branch (e.g. "main")
   * @param {string} newBranch   Name of the branch to create
   * @returns {Promise<{owner:string,repo:string,branch:string,sha:string,created:boolean,url?:string}>}
   */
  async createBranch(repo, baseBranch, newBranch) {
    requireEnv("GITHUB_TOKEN", GITHUB_TOKEN);
    const { owner, name } = normalizeRepo(repo);
    if (!baseBranch) throw new Error("baseBranch is required");
    if (!newBranch) throw new Error("newBranch is required");

    const baseSha = await this._getRefSha({ owner, name }, `heads/${baseBranch}`);
    if (!baseSha) throw new Error(`Could not resolve base branch: ${baseBranch}`);

    try {
      const created = await this.http.post(`/repos/${owner}/${name}/git/refs`, {
        ref: `refs/heads/${newBranch}`,
        sha: baseSha,
      });
      return {
        owner,
        repo: name,
        branch: newBranch,
        sha: created.data?.object?.sha ?? baseSha,
        url: created.data?.url,
        created: true,
      };
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message ?? err.message;
      if (status === 422 && /Reference already exists/i.test(msg)) {
        return { owner, repo: name, branch: newBranch, sha: baseSha, created: false };
      }
      throw new Error(`GitHub createBranch failed: ${msg}`);
    }
  }

  /**
   * Creates a pull request.
   *
   * @param {string|{owner:string,name:string}} repo
   * @param {string} title
   * @param {string} body
   * @param {string} head  Feature branch name (or "owner:branch" for forks)
   * @param {string} base  Target branch (e.g. "main")
   * @returns {Promise<{number:number,url:string,apiUrl:string,state:string,title:string,head:string,base:string}>}
   */
  async createPullRequest(repo, title, body, head, base) {
    requireEnv("GITHUB_TOKEN", GITHUB_TOKEN);
    const { owner, name } = normalizeRepo(repo);
    if (!title) throw new Error("title is required");
    if (!head) throw new Error("head is required");
    if (!base) throw new Error("base is required");

    const r = await this.http.post(`/repos/${owner}/${name}/pulls`, {
      title,
      body: body ?? "",
      head,
      base,
      maintainer_can_modify: true,
    });

    return {
      number: r.data.number,
      url: r.data.html_url,
      apiUrl: r.data.url,
      state: r.data.state,
      title: r.data.title,
      head: r.data.head?.ref,
      base: r.data.base?.ref,
    };
  }

  /**
   * Adds an issue comment to a pull request.
   *
   * @param {string|{owner:string,name:string}} repo
   * @param {number} prNumber
   * @param {string} comment  Markdown-formatted comment body
   * @returns {Promise<{id:number,url:string,createdAt:string}>}
   */
  async addPRComment(repo, prNumber, comment) {
    requireEnv("GITHUB_TOKEN", GITHUB_TOKEN);
    const { owner, name } = normalizeRepo(repo);
    if (!prNumber) throw new Error("prNumber is required");
    if (!comment) throw new Error("comment is required");

    const r = await this.http.post(
      `/repos/${owner}/${name}/issues/${prNumber}/comments`,
      { body: comment }
    );
    return { id: r.data.id, url: r.data.html_url, createdAt: r.data.created_at };
  }

  /**
   * Merges a pull request.
   *
   * @param {string|{owner:string,name:string}} repo
   * @param {number} prNumber
   * @param {{ mergeMethod?: 'merge'|'squash'|'rebase', commitTitle?: string, commitMessage?: string }} [options]
   * @returns {Promise<{merged:boolean,message:string,sha:string,mergeMethod:string}>}
   */
  async mergePR(repo, prNumber, options = {}) {
    requireEnv("GITHUB_TOKEN", GITHUB_TOKEN);
    const { owner, name } = normalizeRepo(repo);
    if (!prNumber) throw new Error("prNumber is required");

    const merge_method = options.mergeMethod ?? "squash";
    const r = await this.http.put(
      `/repos/${owner}/${name}/pulls/${prNumber}/merge`,
      {
        merge_method,
        commit_title: options.commitTitle,
        commit_message: options.commitMessage,
      }
    );
    return {
      merged: r.data.merged,
      message: r.data.message,
      sha: r.data.sha,
      mergeMethod: merge_method,
    };
  }

  /**
   * Fetches a single pull request by number.
   *
   * @param {string|{owner:string,name:string}} repo
   * @param {number} prNumber
   * @returns {Promise<object>} Raw GitHub API PR object
   */
  async getPullRequest(repo, prNumber) {
    requireEnv("GITHUB_TOKEN", GITHUB_TOKEN);
    const { owner, name } = normalizeRepo(repo);
    const r = await this.http.get(`/repos/${owner}/${name}/pulls/${prNumber}`);
    return r.data;
  }

  /**
   * Lists all open pull requests in a repository (up to 100).
   *
   * @param {string|{owner:string,name:string}} repo
   * @returns {Promise<Array<{number:number,title:string,headRefName:string,htmlUrl:string}>>}
   */
  async listOpenPullRequests(repo) {
    requireEnv("GITHUB_TOKEN", GITHUB_TOKEN);
    const { owner, name } = normalizeRepo(repo);
    const r = await this.http.get(`/repos/${owner}/${name}/pulls`, {
      params: { state: "open", per_page: 100 },
    });
    return (r.data ?? []).map((pr) => ({
      number: pr.number,
      title: pr.title,
      headRefName: pr.head?.ref,
      htmlUrl: pr.html_url,
    }));
  }
}

/**
 * Factory — creates a new `GitHubClient` with default configuration.
 * Prefer using this over calling `new GitHubClient()` directly.
 *
 * @returns {GitHubClient}
 */
export const createGitHubClient = () => {
  return new GitHubClient();
};
