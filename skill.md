# Skill: End-to-End Software Delivery Automation

## Overview

This skill enables automatic transformation of a business requirement into production-ready software like a complete software development lifecycle (SDLC), including requirement analysis, ticket generation, implementation, code review, and deployment readiness.

---

## Objectives

* Convert business requirements into structured development tasks
* Automate implementation with high-quality, maintainable code
* Ensure code quality through review and validation
* Deliver production-ready artifacts

---

## Input

* Business Requirement (BRD, user story, or plain text)

---

## Output

* Product Backlog Items (PBIs) / Tickets
* Implemented Code
* Pull Request (PR)
* Reviewed & Approved Code
* Production-ready build artifacts

---

## Workflow

### 1. Requirement Analysis

* Parse and understand the business requirement
* Identify:

  * Functional requirements
  * Non-functional requirements
  * Edge cases
* Generate acceptance criteria

---

### 2. PBI / Ticket Generation

* Break down requirement into PBIs:

  * Feature tickets
  * Subtasks
  * Technical tasks
* Include:

  * Title
  * Description
  * Acceptance Criteria
  * Priority
  * Dependencies

---

### 3. System Design

* Define:

  * Architecture
  * APIs / Contracts
  * Data models
* Ensure scalability and maintainability

---

### 4. Code Implementation

* Generate production-grade code:

  * Clean architecture
  * Proper naming conventions
  * Modular structure
* Include:

  * Unit tests
  * Error handling
  * Logging

---

### 5. Pull Request Creation

* Create PR with:

  * Summary of changes
  * Linked PBIs
  * Testing notes
* Follow repository contribution guidelines

---

### 6. Code Review

* Perform automated + rule-based review:

  * Code quality
  * Security checks
  * Performance considerations
* Suggest improvements
* Ensure all checks pass

---

### 7. Validation & Testing

* Run:

  * Unit tests
  * Integration tests
  * Regression checks
* Validate acceptance criteria

---

### 8. Production Readiness

* Ensure:

  * Build passes
  * No critical issues
  * Configurations are environment-safe
* Prepare deployment artifacts

---

## Constraints

* Follow coding standards and best practices
* Maintain test coverage > 80%

---

## Quality Gates

* All acceptance criteria met
* PR approved
* Tests passing
* No high/critical vulnerabilities

---

## Tools & Integrations

* Issue Tracking: Jira / Azure DevOps
* Version Control: GitHub / GitLab
* CI/CD: Jenkins / GitHub Actions
* Code Quality: SonarQube

---

## Example Flow

### Input

"Users should be able to reset their password via email"

### Output

1. PBIs:

   * Create reset password API
   * Email service integration
   * UI for reset form

2. Code:

   * Backend API
   * Email handler
   * Frontend form

3. PR:

   * Includes implementation + tests

4. Review:

   * Security validation (token expiry, encryption)

5. Production Ready:

   * Deployed with CI/CD pipeline

---

## Success Criteria

* Zero manual intervention required
* High-quality, maintainable code
* Faster delivery cycle
* Reduced human errors

---

## Notes

This skill is designed for autonomous or semi-autonomous software engineering systems and should be integrated with CI/CD and issue tracking systems for full effectiveness.