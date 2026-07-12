import { spawn } from "node:child_process";

interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const sendmailPath = process.env.SENDMAIL_PATH || "/usr/sbin/sendmail";
  const from = process.env.EMAIL_FROM || "noreply@fairbook.hu";

  const to = sanitizeHeader(input.to);
  const subject = sanitizeHeader(input.subject);
  const fromHeader = sanitizeHeader(from);

  const message = [
    `To: ${to}`,
    `From: ${fromHeader}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    "",
  ].join("\n");

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(sendmailPath, ["-i", "-f", fromHeader, "-t"], {
        stdio: ["pipe", "ignore", "pipe"],
      });

      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`sendmail exited with code ${code}: ${stderr}`));
      });

      child.stdin.write(message);
      child.stdin.end();
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("sendEmail failed, falling back to console output", error);
      console.log("EMAIL DEBUG OUTPUT\n", message);
      return;
    }
    throw error;
  }
}
