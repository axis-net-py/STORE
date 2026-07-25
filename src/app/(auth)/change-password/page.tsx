"use client";

import { useTranslations } from "next-intl";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { changePassword } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const t = useTranslations("changePassword");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      toast.error(t("mismatch"));
      return;
    }
    setSaving(true);
    try {
      const res = await changePassword(current, next);
      toast.success(t("success"));
      router.replace(`/${res.tenantId}/dashboard`);
    } catch (err: any) {
      toast.error(err.message || t("error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-lg">{t("title")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current">{t("current")}</Label>
              <Input
                id="current"
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next">{t("next")}</Label>
              <Input
                id="next"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className="h-11"
              />
              <p className="text-[11px] text-muted-foreground">
                {t("hint")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">{t("confirm")}</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
