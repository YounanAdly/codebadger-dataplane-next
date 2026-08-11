import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";

const APP_ID = process.env.APP_ID;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

function getPrivateKey() {
  if (!PRIVATE_KEY) return "";
  return PRIVATE_KEY.replace(/\\n/g, "\n");
}

// In-memory store (use Redis/DB in production)
const branchToggles = new Map();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { owner, repo, branch, enabled } = req.query;

  if (!owner || !repo || !branch || enabled === undefined) {
    return res
      .status(400)
      .json({ error: "Missing parameters: owner, repo, branch, enabled" });
  }

  const key = `${owner}/${repo}/${branch}`;
  const isEnabled = enabled === "true" || enabled === "1";
  branchToggles.set(key, isEnabled);

  return res.status(200).json({
    branch,
    enabled: isEnabled,
    message: isEnabled
      ? `AI review enabled for ${branch}`
      : `AI review disabled for ${branch}`,
  });
}
