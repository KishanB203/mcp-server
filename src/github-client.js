import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const {
  GITHUB_TOKEN,
  REPO_OWNER,
  REPO_NAME,
  GITHUB_API_BASE_URL = "https://api.github.com",
  GITHUB_API_VERSION = "2022-11-28",
} = process.env;

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
}

function normalizeRepo(repo) {
  if (!repo) {
    if (REPO_OWNER && REPO_NAME) return { owner: REPO_OWNER, name: REPO_NAME };
    throw new Error(
      `Missing repo. Pass { owner, name } or set REPO_OWNER and REPO_NAME in .env`
    );
  }

  if (typeof repo === "string") {
    const [owner, name] = repo.split("/");
    if (!owner || !name) {
      throw new Error(`Invalid repo string "${repo}". Expected "owner/name".`);
    }
    return { owner, name };
  }

  const owner = repo.owner || repo.REPO_OWNER;
  const name = repo.name || repo.repo || repo.REPO_NAME;
  if (!owner || !name) {
    throw new Error(`Invalid repo object. Expected { owner, name }.`);
  }
  return { owner, name };
}

function ghHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "Content-Type": "application/json",
    "User-Agent": "claude-mcp-automation/2.0.0",
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return headers;
}

export class GitHubClient {
  constructor({ baseUrl = GITHUB_API_BASE_URL } = {}) {
    this.http = axios.create({
      baseURL: baseUrl,
      headers: ghHeaders(),
      timeout: 30_000,
    });
  }

  async getRefSha({ owner, name }, ref) {
    const r = await this.http.get(`/repos/${owner}/${name}/git/ref/${ref}`);
    return r.data?.object?.sha;
  }

  /**
   * Creates a remote branch pointing at the base branch HEAD.
   * @param {string|{owner:string,name:string}} repo
   * @param {string} baseBranch e.g. "main"
   * @param {string} newBranch e.g. "feature/123-something"
   */
  async createBranch(repo, baseBranch, newBranch) {
    requireEnv("GITHUB_TOKEN", GITHUB_TOKEN);
    const { owner, name } = normalizeRepo(repo);
    if (!baseBranch) throw new Error("baseBranch is required");
    if (!newBranch) throw new Error("newBranch is required");

    const baseSha = await this.getRefSha({ owner, name }, `heads/${baseBranch}`);
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
        sha: created.data?.object?.sha || baseSha,
        url: created.data?.url,
        created: true,
      };
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err.message;
      if (status === 422 && /Reference already exists/i.test(msg)) {
        return { owner, repo: name, branch: newBranch, sha: baseSha, created: false };
      }
      throw new Error(`GitHub createBranch failed: ${msg}`);
    }
  }

  /**
   * Creates a PR.
   * @param {string|{owner:string,name:string}} repo
   * @param {string} title
   * @param {string} body
   * @param {string} head branch name (or "owner:branch" for forks)
   * @param {string} base base branch name (e.g. "main")
   */
  async createPullRequest(repo, title, body, head, base) {
    requireEnv("GITHUB_TOKEN", GITHUB_TOKEN);
    const { owner, name } = normalizeRepo(repo);
    if (!title) throw new Error("title is required");
    if (!head) throw new Error("head is required");
    if (!base) throw new Error("base is required");

    const r = await this.http.post(`/repos/${owner}/${name}/pulls`, {
      title,
      body: body || "",
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
   * Adds a comment to a PR (issue comment).
   * @param {string|{owner:string,name:string}} repo
   * @param {number} prNumber
   * @param {string} comment
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
   * Merges a PR.
   * @param {string|{owner:string,name:string}} repo
   * @param {number} prNumber
   * @param {{mergeMethod?: 'merge'|'squash'|'rebase', commitTitle?: string, commitMessage?: string}} [options]
   */
  async mergePR(repo, prNumber, options = {}) {
    requireEnv("GITHUB_TOKEN", GITHUB_TOKEN);
    const { owner, name } = normalizeRepo(repo);
    if (!prNumber) throw new Error("prNumber is required");

    const merge_method = options.mergeMethod || "squash";
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

  async getPullRequest(repo, prNumber) {
    requireEnv("GITHUB_TOKEN", GITHUB_TOKEN);
    const { owner, name } = normalizeRepo(repo);
    const r = await this.http.get(`/repos/${owner}/${name}/pulls/${prNumber}`);
    return r.data;
  }

  async listOpenPullRequests(repo) {
    requireEnv("GITHUB_TOKEN", GITHUB_TOKEN);
    const { owner, name } = normalizeRepo(repo);
    const r = await this.http.get(`/repos/${owner}/${name}/pulls`, {
      params: { state: "open", per_page: 100 },
    });
    return (r.data || []).map((pr) => ({
      number: pr.number,
      title: pr.title,
      headRefName: pr.head?.ref,
      htmlUrl: pr.html_url,
    }));
  }
}

export function createGitHubClient() {
  return new GitHubClient();
}

