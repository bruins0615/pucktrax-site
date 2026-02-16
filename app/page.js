import Image from "next/image";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white text-center px-6">

      <Image
        src="/pucktraxlogo.png"
        alt="PuckTrax Logo"
        width={260}
        height={260}
        className="mb-6"
        priority
      />

      <p className="text-2xl font-semibold text-gray-800 mb-4">
        Advanced hockey analytics and visualizations
      </p>

      <p className="text-md text-gray-500 mb-10 max-w-xl">
        Coming soon. PuckTrax reveals the game beneath the surface — trends, momentum, and performance insights you can’t see in the box score.
      </p>

      <a
        href="mailto:contact@pucktrax.com"
        className="rounded-lg bg-black text-white px-6 py-3 text-lg hover:bg-gray-800 transition"
      >
        Contact
      </a>

    </main>
  );
}