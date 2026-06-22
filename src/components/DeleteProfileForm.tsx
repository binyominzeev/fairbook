"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const CONFIRMATION_TEXT = "TORLOM";

interface Props {
  profilePath: string;
}

export default function DeleteProfileForm({ profilePath }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const canSubmit =
    password.trim().length > 0 && confirmation.trim().toUpperCase() === CONFIRMATION_TEXT;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isDeleting) return;

    setError("");
    setIsDeleting(true);

    try {
      const response = await fetch("/api/profile/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "A profil törlése sikertelen volt.");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Hálózati hiba történt. Kérjük, próbáld újra.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Profil törlése</h1>
      <p className="mt-2 text-sm text-slate-600">
        Ez az oldal végleges fióktörlésre szolgál. A törlés után a profilodhoz tartozó adatok
        visszaállíthatatlanul eltávolításra kerülnek.
      </p>

      <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        A folytatáshoz add meg újra a jelszavad, majd írd be ezt a megerősítő szót: {" "}
        <strong>{CONFIRMATION_TEXT}</strong>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-900">Jelszó</span>
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-red-500"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-900">
            Megerősítő szó ({CONFIRMATION_TEXT})
          </span>
          <input
            type="text"
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setError("");
            }}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm uppercase tracking-wider text-slate-900 outline-none focus:border-red-500"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit || isDeleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isDeleting ? "Törlés folyamatban..." : "Profil végleges törlése"}
          </button>

          <Link
            href={profilePath}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
          >
            Mégsem
          </Link>
        </div>
      </form>
    </section>
  );
}