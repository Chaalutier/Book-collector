"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { User } from "@supabase/supabase-js"

export default function Navbar() {
    const [user, setUser] = useState<User | null>(null);
    useEffect(() => {
        const getUser = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            setUser(user);
        };

        getUser();
    }, []);

    return (
        <nav className="border-b">
            <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
                <Link href="/" className="text-xl font-bold">
                    Book Collector
                </Link>

                <div className="flex gap-4">
                    <Link href="/">Accueil</Link>
                    <Link href="/library">Ma pile à lire</Link>
                    <Link href="/login">Connexion</Link>
                    <Link href="/register">Inscription</Link>

                    <p>{user ? "Connecté" : "Non connecté"}</p>
                </div>
            </div>
        </nav>
    );
}