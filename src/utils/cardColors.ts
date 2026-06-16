/** A curated set of vibrant-yet-harmonious card header gradients */
export const CARD_GRADIENTS = [
  'from-[#007A87] to-[#00A896]',   // teal (original)
  'from-[#5B2D8E] to-[#8B5CF6]',   // purple
  'from-[#B45309] to-[#F59E0B]',   // amber
  'from-[#065F46] to-[#10B981]',   // emerald
  'from-[#1E3A8A] to-[#3B82F6]',   // blue
  'from-[#7C1D6F] to-[#EC4899]',   // pink
  'from-[#7F1D1D] to-[#EF4444]',   // red
  'from-[#0F172A] to-[#334155]',   // slate dark
  'from-[#064E3B] to-[#059669]',   // dark emerald
  'from-[#1E3A5F] to-[#0EA5E9]',   // sky blue
  'from-[#4A1942] to-[#A855F7]',   // violet-pink
  'from-[#713F12] to-[#D97706]',   // warm amber
];

/** Deterministically pick a gradient for a given string id */
export function getCardGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return CARD_GRADIENTS[hash % CARD_GRADIENTS.length];
}

/** Pick a random gradient */
export function randomCardGradient(): string {
  return CARD_GRADIENTS[Math.floor(Math.random() * CARD_GRADIENTS.length)];
}

/** All 40 curated Unsplash education banners */
export const EDUCATION_BANNERS = [
  // Classic study / desk
  'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=70',
  // Science & lab
  'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1554475901-4538ddfbccc2?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=70',
  // Mathematics & geometry
  'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1453733190371-0a9bedd82893?w=800&auto=format&fit=crop&q=70',
  // Classroom & lecture
  'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&auto=format&fit=crop&q=70',
  // Books & library
  'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1542396601-dca920ea2807?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1519682577862-22b62b24e493?w=800&auto=format&fit=crop&q=70',
  // Technology & digital
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1550439062-609e1531270e?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=70',
  // Art & creativity
  'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&auto=format&fit=crop&q=70',
  // Geography & earth
  'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1589330694653-ded6df03f754?w=800&auto=format&fit=crop&q=70',
  // Writing & notes
  'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?w=800&auto=format&fit=crop&q=70',
  // Abstract / gradient  
  'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1533628635777-112b2239b1c7?w=800&auto=format&fit=crop&q=70',
  // Students / teamwork
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1543269664-7eef42226a21?w=800&auto=format&fit=crop&q=70',
  'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800&auto=format&fit=crop&q=70',
];

/** Pick a random banner from the library */
export function randomBanner(): string {
  return EDUCATION_BANNERS[Math.floor(Math.random() * EDUCATION_BANNERS.length)];
}
