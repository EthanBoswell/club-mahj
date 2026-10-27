import { isConfigured } from "@/lib/supabase/config";

export default function DemoBanner() {
  if (isConfigured) return null;
  return (
    <div className="wrap" style={{ marginTop: 16 }}>
      <div className="notice notice-demo">
        <strong>Preview mode.</strong> Showing sample members and games. Connect Supabase (see README) to turn on real sign-ups, invites and the ladder.
      </div>
    </div>
  );
}
