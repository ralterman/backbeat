import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { VideoUploader } from "@/components/VideoUploader";
import { getUsageCount, getUsageLimit, getUserPlan } from "@/lib/usage";
import Link from "next/link";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "text-[#a0a0b8] bg-[#1E1E1E]" },
  UPLOADING: { label: "Uploading", color: "text-[#c8b97a] bg-[#c8b97a]/10" },
  UPLOADED: { label: "Uploaded", color: "text-[#c8b97a] bg-[#c8b97a]/10" },
  ANALYZING: { label: "Analyzing...", color: "text-yellow-400 bg-yellow-900/20" },
  ANALYZED: { label: "Analyzed", color: "text-green-400 bg-green-900/20" },
  FAILED: { label: "Failed", color: "text-red-400 bg-red-900/20" },
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  const userId = session.user.id;
  const params = await searchParams;
  const upgraded = params.upgraded === "true";

  const [videos, used, limit, plan] = await Promise.all([
    prisma.video.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        analysis: {
          select: { id: true, moodTags: true, energyScore: true },
        },
      },
    }),
    getUsageCount(userId, "analysis"),
    getUsageLimit(userId),
    getUserPlan(userId),
  ]);

  const remaining = Math.max(0, limit - used);
  const usagePct = limit > 0 ? (used / limit) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {upgraded && (
        <div className="mb-6 bg-green-900/20 border border-green-700/30 rounded-xl px-5 py-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          <p className="text-green-300 text-sm font-medium">
            Your plan has been upgraded! Enjoy your new analysis quota.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-[#a0a0b8] mt-1">
            Welcome back, {session.user.name ?? session.user.email}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-2.5">
            <p className="text-xs text-[#a0a0b8] mb-1 capitalize">{plan.toLowerCase()} plan</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 w-24 bg-[#1E1E1E] rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    usagePct >= 80 ? "bg-red-500" : usagePct >= 60 ? "bg-yellow-500" : "bg-[#c8b97a]"
                  }`}
                  style={{ width: `${Math.min(100, usagePct)}%` }}
                />
              </div>
              <span className="text-[#c8b97a] text-sm font-medium">{remaining}/{limit}</span>
            </div>
            <p className="text-xs text-[#6a6a8a] mt-0.5">analyses remaining</p>
          </div>
          {plan === "FREE" && (
            <Link
              href="/pricing"
              className="bg-white hover:bg-[#f0f0f0] text-[#0a0a0f] text-sm px-4 py-2.5 rounded-xl transition-colors font-bold"
            >
              Upgrade
            </Link>
          )}
        </div>
      </div>

      {/* Upload zone */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">Analyze a new video</h2>
        {remaining > 0 ? (
          <VideoUploader />
        ) : (
          <div className="border-2 border-dashed border-[#2A2A2A] rounded-2xl p-12 text-center">
            <p className="text-[#a0a0b8] mb-4">You&apos;ve used all your analyses this month.</p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 bg-white hover:bg-[#f0f0f0] text-[#0a0a0f] font-bold px-6 py-3 rounded-xl transition-colors"
            >
              Upgrade your plan
            </Link>
          </div>
        )}
      </div>

      {/* Recent videos */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Recent analyses</h2>
        {videos.length === 0 ? (
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-12 text-center">
            <svg className="w-12 h-12 text-[#2a2a3a] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-[#a0a0b8]">No videos yet. Upload your first video above!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {videos.map((video) => {
              const statusInfo = STATUS_LABELS[video.status] ?? STATUS_LABELS.PENDING;
              return (
                <div
                  key={video.id}
                  className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-5 py-4 flex items-center justify-between hover:border-[#3a3a5a] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#1E1E1E] rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#3a3a5a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium truncate max-w-xs">
                        {video.originalName}
                      </p>
                      <p className="text-[#6a6a8a] text-xs mt-0.5">
                        {formatFileSize(video.fileSize)} · {formatDate(video.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {video.analysis && (
                      <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
                        {video.analysis.moodTags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs text-[#a0a0b8] bg-[#1E1E1E] px-2 py-0.5 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    {video.status === "ANALYZED" && (
                      <Link
                        href={`/analyze/${video.id}`}
                        className="text-[#c8b97a] hover:text-white text-sm font-medium transition-colors flex-shrink-0"
                      >
                        View results →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
