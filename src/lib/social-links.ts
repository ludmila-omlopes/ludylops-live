import { FaBluesky, FaDiscord, FaGithub, FaInstagram, FaThreads, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { TbWorld } from "react-icons/tb";

export const socialLinks = [
  {
    label: "YouTube",
    href: "https://www.youtube.com/@ludylopsgames",
    Icon: FaYoutube,
  },
  {
    label: "Twitter",
    href: "https://twitter.com/ludylops",
    Icon: FaXTwitter,
  },
  {
    label: "Threads",
    href: "https://www.threads.net/@ludylops",
    Icon: FaThreads,
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/ludylopsGames",
    Icon: FaInstagram,
  },
  {
    label: "Discord",
    href: "https://discord.gg/qGHZxtXDAK",
    Icon: FaDiscord,
  },
  {
    label: "Bluesky",
    href: "https://bsky.app/profile/ludylops.bsky.social",
    Icon: FaBluesky,
  },
  {
    label: "Site pessoal",
    href: "https://ludylops.com",
    Icon: TbWorld,
  },
  {
    label: "GitHub",
    href: "https://github.com/ludmila-omlopes",
    Icon: FaGithub,
  },
] as const;
