This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### 只部署到 antigravity-properties-system-v2，不要觸發 p2

若同一個 GitHub repo 連了多個 Vercel 專案（例如 `antigravity-properties-system-v2` 和 `p2`），每次 push 會觸發所有已連線專案。若只要更新 `antigravity-properties-system-v2`、不要讓 `p2` 收到 push：

1. 登入 [Vercel Dashboard](https://vercel.com/dashboard)
2. 進入 **p2** 專案
3. **Settings** → **Git** → **Disconnect** 該 repository，或關閉 **Production** 的自動部署

之後 push 只會觸發仍連著該 repo 的專案（例如 antigravity-properties-system-v2）。本機 CLI 已連結到 `antigravity-properties-system-v2`（`.vercel/project.json`），執行 `vercel --prod` 會部署到該專案。
