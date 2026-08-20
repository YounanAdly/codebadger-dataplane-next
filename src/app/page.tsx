import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-950 text-white font-sans min-h-screen p-6">
      <main className="flex flex-1 w-full max-w-2xl flex-col items-center justify-center text-center gap-8 py-16">
        <div className="relative w-32 h-32 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 bg-zinc-900 flex items-center justify-center">
          <Image
            src="/codebadger-logo.jpg"
            alt="CodeBadger Logo"
            width={128}
            height={128}
            className="object-cover"
            priority
          />
        </div>
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            CodeBadger
          </h1>
          <p className="text-zinc-400 text-lg max-w-md">
            Automated, high-precision AI code reviews for GitHub and Azure DevOps pull requests.
          </p>
        </div>

        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-left flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Dataplane Online
            </span>
            <span className="text-xs text-zinc-500 font-mono">Next.js Data Plane</span>
          </div>

          <div className="space-y-2 text-sm text-zinc-300">
            <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3">
              <span className="text-zinc-400">GitHub Webhook</span>
              <code className="bg-zinc-800 px-2 py-0.5 rounded text-xs text-zinc-200">/api/webhook</code>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3">
              <span className="text-zinc-400">Azure DevOps Webhook</span>
              <code className="bg-zinc-800 px-2 py-0.5 rounded text-xs text-zinc-200">/api/azure-webhook</code>
            </div>
          </div>
        </div>

        <p className="text-xs text-zinc-600">
          Powered by CodeBadger AI Review Engine
        </p>
      </main>
    </div>
  );
}
