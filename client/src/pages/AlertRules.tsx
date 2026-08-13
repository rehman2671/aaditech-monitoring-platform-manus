import React, { useEffect, useState } from "react";
import { AlertRuleItem, fetchAlertRules } from "@/lib/sentinelApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Plus, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AlertRules() {
  const [rules, setRules] = useState<AlertRuleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [metric, setMetric] = useState<string>("cpu_utilization");
  const [operator, setOperator] = useState<string>(">");
  const [threshold, setThreshold] = useState<string>("90");
  const [severity, setSeverity] = useState<string>("CRITICAL");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAlertRules();
      setRules(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load alert rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const numThreshold = parseFloat(threshold);
      if (isNaN(numThreshold)) {
        toast.error("Please enter a valid numeric threshold");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/v1/alert-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metric,
          operator,
          threshold: numThreshold,
          severity,
          enabled: true,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create alert rule");
      }

      toast.success("Alert threshold rule created successfully");
      setThreshold("90");
      loadRules();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create rule");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-400" />
            Alert Threshold Rules
          </h1>
          <p className="text-sm text-slate-400">
            Configure automated telemetry threshold checks, severity levels, and dispatcher routing.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 bg-slate-900/60 border-slate-800 text-slate-100 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              Create New Rule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300">Metric</label>
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="cpu_utilization">CPU Utilization (%)</option>
                  <option value="ram_utilization">RAM Utilization (%)</option>
                  <option value="disk_free_percent">Disk Free Space (%)</option>
                  <option value="battery_health">Battery Health (%)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300">Operator</label>
                  <select
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value=">">&gt; Greater Than</option>
                    <option value="<">&lt; Less Than</option>
                    <option value="==">== Equals</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">Threshold</label>
                  <input
                    type="text"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="CRITICAL">Critical</option>
                  <option value="WARNING">Warning</option>
                  <option value="INFO">Info</option>
                </select>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Save Threshold Rule
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 bg-slate-900/60 border-slate-800 text-slate-100 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-blue-400" />
                Configured Tenant Rules
              </span>
              <Badge variant="outline" className="border-slate-700 text-slate-300">
                {rules.length} Active
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 flex items-center justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2 text-blue-500" />
                Loading rules...
              </div>
            ) : error ? (
              <div className="py-8 text-center text-red-400 text-sm">{error}</div>
            ) : rules.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
                No custom alert threshold rules configured. Use the form on the left to add one.
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-4 bg-slate-950/60 border border-slate-800/80 rounded-lg"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-slate-200 font-semibold">{rule.metric}</span>
                        <Badge
                          variant={rule.severity === "CRITICAL" ? "destructive" : "secondary"}
                          className={rule.severity === "CRITICAL" ? "bg-red-950 text-red-400 border-red-800" : "bg-amber-950 text-amber-400 border-amber-800"}
                        >
                          {rule.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400">
                        Trigger condition: <code className="text-slate-300 font-mono">{rule.metric} {rule.operator} {rule.threshold}</code>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-emerald-800 bg-emerald-950/40 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Enabled
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

  const [testUrl, setTestUrl] = useState<string>("");
  const [testProvider, setTestProvider] = useState<string>("slack");
  const [testing, setTesting] = useState<boolean>(false);

  const handleTestWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testUrl) {
      toast.error("Please enter a webhook URL to test");
      return;
    }
    setTesting(true);
    try {
      const result = await import("@/lib/sentinelApi").then(mod => mod.testWebhook(testUrl, testProvider));
      if (result.success) {
        toast.success(result.message || "Webhook test dispatched successfully");
      } else {
        toast.error(result.error || "Webhook test dispatch failed");
      }
    } catch (err: any) {
      toast.error(err?.message || "Webhook test failed");
    } finally {
      setTesting(false);
    }
  };

        <Card className="lg:col-span-3 bg-slate-900/60 border-slate-800 text-slate-100 shadow-xl mt-6">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-400" />
              Test Webhook Dispatcher (Slack / PagerDuty / Generic)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTestWebhook} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="text-xs font-medium text-slate-300">Provider</label>
                <select
                  value={testProvider}
                  onChange={(e) => setTestProvider(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="slack">Slack</option>
                  <option value="pagerduty">PagerDuty</option>
                  <option value="generic">Generic JSON</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300">Webhook Target URL</label>
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <Button
                  type="submit"
                  disabled={testing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Bell className="w-4 h-4 mr-2" />}
                  Send Test Alert
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
