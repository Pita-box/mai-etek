const execPath = process.env.npm_execpath || "";

if (!execPath.includes("pnpm")) {
  console.error("This project uses pnpm. Use pnpm install and pnpm run dev.");
  process.exit(1);
}
