import { useCallback, useEffect, useState } from "react";
import { api, getStoredSession, storeSession } from "../api/client";
import type { AuthSession } from "../api/types";

export function useAuth() {
  /**
   * ログイン状態とログイン/登録/ログアウト操作をまとめて扱うHook。
   *
   * Returns:
   *   { session, loading, login, register, logout }: 認証状態と操作関数。
   */
  // 現在のログイン状態。初期値はこの端末に保存済みのセッション。
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  // ログイン/登録の多重実行を防ぐための状態。
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 起動時に保存済みトークンを検証し、有効なら最新セッションへ更新する。
    const stored = getStoredSession();
    if (!stored?.token) return;
    api.auth.me(stored.token)
      .then(next => {
        if (next?.userId) {
          const merged = { ...stored, ...next, token: next.token || stored.token };
          storeSession(merged);
          setSession(merged);
        } else {
          storeSession(null);
          setSession(null);
        }
      })
      .catch(() => null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    /**
     * メールアドレスとパスワードでログインする。
     *
     * Args:
     *   email: ログイン用メールアドレス。
     *   password: ログイン用パスワード。
     *
     * Returns:
     *   Promise<AuthSession>: ログイン後のセッション情報。
     */
    // メールとパスワードでログインし、この端末にセッションを保持する。
    setLoading(true);
    try {
      const next = await api.auth.login(email, password);
      storeSession(next);
      setSession(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    /**
     * メールアドレスとパスワードで新規登録する。
     *
     * Args:
     *   email: 登録するメールアドレス。
     *   password: 登録するパスワード。
     *
     * Returns:
     *   Promise<AuthSession>: 登録後のセッション情報。
     */
    // 新規登録後はそのままログイン済みとして保存する。
    setLoading(true);
    try {
      const next = await api.auth.register(email, password);
      storeSession(next);
      setSession(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    /**
     * 現在端末のログインセッションを削除する。
     *
     * Returns:
     *   Promise<void>: ログアウト処理の完了。
     */
    // サーバー側はJWT方式なので、端末の保存情報を消すことが実質ログアウト。
    await api.auth.logout().catch(() => null);
    storeSession(null);
    setSession(null);
  }, []);

  const updateProfile = useCallback(async (profile: { nickname: string; avatarImage?: string }) => {
    if (!session?.userId) throw new Error("ログインが必要です。");
    const next = await api.auth.updateProfile({
      userId: session.userId,
      nickname: profile.nickname,
      avatarImage: profile.avatarImage
    });
    storeSession(next);
    setSession(next);
    return next;
  }, [session?.userId]);

  const previewProfile = useCallback((profile: { nickname?: string; avatarImage?: string }) => {
    setSession(current => current ? { ...current, ...profile } : current);
  }, []);

  return { session, loading, login, register, logout, updateProfile, previewProfile };
}
