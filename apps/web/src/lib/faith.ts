export interface FaithMessage {
  verse: string;
  reference: string;
  message: string;
}

export const BIBLE_VERSES: { text: string; ref: string }[] = [
  { text: "I can do all this through him who gives me strength.", ref: "Philippians 4:13" },
  { text: "The Lord is my shepherd; I shall not want.", ref: "Psalm 23:1" },
  { text: "Trust in the Lord with all your heart and lean not on your own understanding.", ref: "Proverbs 3:5" },
  { text: "Be strong and courageous. Do not be afraid, for the Lord your God will be with you wherever you go.", ref: "Joshua 1:9" },
  { text: "For I know the plans I have for you, plans to prosper you and not to harm you, plans to give you hope and a future.", ref: "Jeremiah 29:11" },
  { text: "Cast all your anxiety on him because he cares for you.", ref: "1 Peter 5:7" },
  { text: "The Lord is close to the brokenhearted and saves those who are crushed in spirit.", ref: "Psalm 34:18" },
  { text: "But those who hope in the Lord will renew their strength. They will soar on wings like eagles.", ref: "Isaiah 40:31" },
  { text: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.", ref: "Philippians 4:6" },
  { text: "Your word is a lamp for my feet, a light on my path.", ref: "Psalm 119:105" },
  { text: "Come to me, all you who are weary and burdened, and I will give you rest.", ref: "Matthew 11:28" },
  { text: "And we know that in all things God works for the good of those who love him.", ref: "Romans 8:28" },
  { text: "I have been crucified with Christ and I no longer live, but Christ lives in me.", ref: "Galatians 2:20" },
  { text: "For God so loved the world that he gave his one and only Son.", ref: "John 3:16" },
  { text: "The joy of the Lord is your strength.", ref: "Nehemiah 8:10" },
  { text: "Seek first his kingdom and his righteousness, and all these things will be given to you as well.", ref: "Matthew 6:33" },
  { text: "Love is patient, love is kind.", ref: "1 Corinthians 13:4" },
  { text: "Be still, and know that I am God.", ref: "Psalm 46:10" },
  { text: "If any of you lacks wisdom, you should ask God, who gives generously to all.", ref: "James 1:5" },
  { text: "I praise you because I am fearfully and wonderfully made.", ref: "Psalm 139:14" },
  { text: "Commit to the Lord whatever you do, and he will establish your plans.", ref: "Proverbs 16:3" },
  { text: "He gives strength to the weary and increases the power of the weak.", ref: "Isaiah 40:29" },
  { text: "The Lord your God goes with you; he will never leave you nor forsake you.", ref: "Deuteronomy 31:6" },
  { text: "Rejoice always, pray continually, give thanks in all circumstances.", ref: "1 Thessalonians 5:16-18" },
  { text: "For we live by faith, not by sight.", ref: "2 Corinthians 5:7" },
  { text: "Every good and perfect gift is from above, coming down from the Father of the heavenly lights.", ref: "James 1:17" },
  { text: "Let all that you do be done in love.", ref: "1 Corinthians 16:14" },
  { text: "A gentle answer turns away wrath, but a harsh word stirs up anger.", ref: "Proverbs 15:1" },
  { text: "May the God of hope fill you with all joy and peace as you trust in him.", ref: "Romans 15:13" },
  { text: "Now faith is confidence in what we hope for and assurance about what we do not see.", ref: "Hebrews 11:1" },
];

export const PRAYERS: string[] = [
  "Lord, guide my steps today and fill my heart with peace. Let everything I do this day be done with love, and when evening comes, may I look back and see Your hand in every moment.",
  "Father, thank You for this new day. Use me for Your glory in the small tasks and the big ones alike, and let someone encounter Your kindness through me today.",
  "Jesus, give me strength for today and hope for tomorrow. When I grow weary, remind me that Your grace is enough, and when I succeed, keep my heart humble and grateful.",
  "Lord, help me to be kind, patient, and faithful in all I do. Guard my tongue from harsh words, open my hands to those in need, and keep my thoughts fixed on what is good.",
  "Heavenly Father, bless my family and keep them safe today. Watch over each one, strengthen our love for one another, and let our home be a place of peace and joy.",
  "God, calm my anxious heart and let me rest in Your presence. When worries crowd in, remind me that You hold tomorrow and that I can trust You with everything I cannot control.",
  "Lord, open my eyes to see Your goodness in every moment. Help me notice the small blessings hidden in this ordinary day and give thanks in all circumstances.",
  "Father, give me wisdom for the decisions I face today. Guide my words and choices, and when the way seems unclear, help me to wait patiently on You rather than rush ahead.",
  "Jesus, thank You for Your unfailing love. Help me share it today through forgiveness, encouragement, and quiet acts of service that no one else sees.",
  "Lord, create in me a clean heart, O God, and renew a steadfast spirit within me. Remove every bitterness and resentment, and let love, truth, and peace dwell richly in me.",
  "God, be my refuge and strength in every trial. When the day is hard, hold me steady; when I fall, lift me up; and let my weakness become a place where Your strength is seen.",
  "Father, lead me away from temptation and deliver me from evil. Keep my eyes fixed on what is true and honorable, and protect me from the small compromises that steal the soul.",
  "Lord, let my words today bring life, not harm. Help me speak with gentleness and truth, to listen before I answer, and to use my voice to build others up.",
  "Heavenly Father, thank You for the gift of another day to serve You. Give me energy for the work ahead, joy in the doing of it, and the awareness that all of it is worship.",
  "God, help me to trust You even when I cannot see the way. When doors close, keep my heart open to the new ones You are opening, and let faith lead where understanding cannot.",
  "Lord, teach me to forgive as I have been forgiven. Loosen the grip of every past hurt, and help me release those who have wronged me, so that I may walk in freedom and peace.",
  "Father, renew my strength like the eagle's and help me rise. When I am tired, give me rest; when I am discouraged, give me vision; when I am weak, be my strength.",
  "Jesus, be the center of my home and my heart. Let everything I do begin with You and end with gratitude, and may the peace You give overflow to everyone around me.",
  "Lord, thank You for Your Word — let it light my path today. Give me understanding as I read, a willing heart to obey, and the discipline to make time for You.",
  "God, give me courage to follow You wherever You lead. When the road is unfamiliar, go before me; when it is steep, walk beside me; and let me never turn back from faithfulness.",
  "Father, guard my thoughts and keep them on what is true and pure. Protect my mind from worry and envy, and fill it instead with hope, thankfulness, and good desires.",
  "Lord, help me to work with excellence and joy for Your glory. Give me diligence where I am tempted to delay, and contentment where I am tempted to complain.",
  "God, comfort all who are hurting today and use me to bring hope. Open my eyes to the weary ones around me, and let my presence be a small sign of Your care.",
  "Father, thank You for Your mercy that is new every morning. I did not earn Your goodness and yet it greets me each day; help me to extend that same mercy to others.",
  "Jesus, make me a peacemaker in my home, my work, and my community. Where there is conflict, bring reconciliation through me; where there is division, let me build bridges of love.",
  "Lord, I surrender this day to You — guide every word and deed. Let my plans bend to Your will, my ambitions serve Your purposes, and my life reflect Your light.",
  "God, fill me with Your Spirit and let Your fruit grow in me. Produce in me love, joy, peace, patience, kindness, goodness, faithfulness, gentleness, and self-control.",
  "Father, bless the work of my hands and the thoughts of my heart. Make what I do today meaningful, what I build lasting, and what I love worthy of Your kingdom.",
  "Lord, in my waiting, help me to be still and know that You are God. Teach me that seasons of patience are not wasted time, but the soil in which trust grows deeper.",
  "Heavenly Father, let my life be a living testimony of Your love. In how I treat others, in how I face trials, and in how I give thanks, let Your goodness be seen today.",
];

export const QURAN_VERSES: { text: string; ref: string }[] = [
  { text: "Indeed, with hardship comes ease.", ref: "Quran 94:6" },
  { text: "And He found you lost and guided you.", ref: "Quran 93:7" },
  { text: "And rely upon Allah; and sufficient is Allah as Disposer of affairs.", ref: "Quran 33:3" },
  { text: "So remember Me; I will remember you.", ref: "Quran 2:152" },
  { text: "And He is with you wherever you are.", ref: "Quran 57:4" },
  { text: "Verily, in the remembrance of Allah do hearts find rest.", ref: "Quran 13:28" },
  { text: "My mercy encompasses all things.", ref: "Quran 7:156" },
  { text: "Call upon Me; I will respond to you.", ref: "Quran 40:60" },
  { text: "Indeed, Allah loves those who rely upon Him.", ref: "Quran 3:159" },
  { text: "And whoever puts their trust in Allah, He will suffice them.", ref: "Quran 65:3" },
  { text: "Allah does not burden a soul beyond that it can bear.", ref: "Quran 2:286" },
  { text: "And say: My Lord, increase me in knowledge.", ref: "Quran 20:114" },
  { text: "Indeed, the patient will be given their reward without account.", ref: "Quran 39:10" },
  { text: "So do not weaken and do not grieve, and you will be superior if you are true believers.", ref: "Quran 3:139" },
  { text: "Indeed I am near. I respond to the call of the caller when he calls upon Me.", ref: "Quran 2:186" },
  { text: "And We have certainly made the Quran easy for remembrance, so is there any who will remember?", ref: "Quran 54:17" },
  { text: "Whoever does righteousness, male or female, while being a believer — We will surely cause them to live a good life.", ref: "Quran 16:97" },
  { text: "Indeed, Allah is with the patient.", ref: "Quran 2:153" },
  { text: "He is the First and the Last, the Ascendant and the Intimate, and He is, of all things, Knowing.", ref: "Quran 57:3" },
  { text: "And for those who fear Allah, He will prepare a way out and will provide for them from where they do not expect.", ref: "Quran 65:2-3" },
  { text: "We will surely test you with something of fear and hunger. But give good tidings to the patient.", ref: "Quran 2:155" },
  { text: "And be not like those who forgot Allah, so He made them forget themselves.", ref: "Quran 59:19" },
  { text: "The example of those who spend in the way of Allah is like a grain of corn which produces seven ears.", ref: "Quran 2:261" },
  { text: "He has succeeded who purifies it, and he has failed who instills it with corruption.", ref: "Quran 91:9-10" },
  { text: "Indeed, prayer prohibits immorality and wrongdoing.", ref: "Quran 29:45" },
  { text: "And He found you poor and made you self-sufficient.", ref: "Quran 93:8" },
  { text: "So which of the favors of your Lord would you deny?", ref: "Quran 55:13" },
  { text: "Say: He is Allah, [who is] One.", ref: "Quran 112:1" },
  { text: "And your Lord is the Forgiving, full of Mercy.", ref: "Quran 18:58" },
  { text: "Indeed, this world's life is but amusement and diversion, but the home of the Hereafter is better for those who fear Allah.", ref: "Quran 6:32" },
];

export const DUAS: string[] = [
  "O Allah, grant me peace in the morning and gratitude in the evening. Make my day light with faith, my work blessed with sincerity, and my heart content with what You have decreed.",
  "O Allah, guide me in my affairs and make them easy for me. Where there is difficulty, create a way out; where there is confusion, grant me clarity; and protect me from my own bad decisions.",
  "O Allah, forgive my sins, known and unknown. Cleanse my heart of envy and pride, and replace them with humility, sincerity, and a deep love for what pleases You.",
  "O Allah, protect my family from every harm. Guard them in the morning, the evening, and in their sleep, and unite our hearts upon goodness and mercy.",
  "O Allah, increase me in knowledge and wisdom. Let me learn what benefits me, benefit from what I learn, and never make me satisfied with ignorance while truth is within reach.",
  "O Allah, grant me patience in times of trial. When the test is long, keep my hope alive; when I am weak, strengthen my resolve; and let every difficulty purify me rather than break me.",
  "O Allah, make my heart firm upon Your religion. Protect it from doubt and fluctuation, and anchor me to what is true even when the world shifts around me.",
  "O Allah, provide for me from where I do not expect. Relieve my worries about provision, and make what You give me a source of gratitude rather than greed.",
  "O Allah, I seek refuge in You from worry and sorrow. Lift the heaviness from my chest, and replace anxiety with trust in Your decree and the beautiful knowledge that You are with me.",
  "O Allah, open my chest and ease my affairs. Untie the knots that block my tongue and my progress, and let my burdens feel lighter because I carry them with You.",
  "O Allah, thank You for another day — make it a day of goodness. Let its morning be peaceful, its middle fruitful, and its end a cause for quiet gratitude.",
  "O Allah, forgive my parents and have mercy on them as they raised me. Reward them for every sacrifice, and make me a source of comfort and honor to them in this life.",
  "O Allah, help me remember You, thank You, and worship You well. Let my remembering be constant, my gratitude sincere, and my worship a delight rather than a duty.",
  "O Allah, grant me a sound heart. A heart that loves You, trusts in You, and finds its rest in You — and that is slow to anger, quick to forgive, and generous in kindness.",
  "O Allah, make my words gentle and my deeds sincere. Let no harm reach anyone through my tongue, and let every action of mine be for You alone.",
  "O Allah, protect me from laziness and weakness. Give my body strength, my mind focus, and my spirit the will to strive for what is good in this world and the next.",
  "O Allah, beautify my character as You beautified creation. Grant me patience, honesty, courage, and gentleness, and make me beloved to Your creation by Your grace.",
  "O Allah, grant me health in body and soundness in heart. Cure what is ill in me, strengthen what is weak, and let good health be a means of gratitude and service.",
  "O Allah, You are my Protector — defend me. Defend my faith from corruption, my dignity from humiliation, and my affairs from ruin, for You are the Best of guardians.",
  "O Allah, forgive me and my loved ones, the living and the departed. Cover our faults, purify our deeds, and gather us together again in Your mercy.",
  "O Allah, make my morning light and my day blessed. Barakah in my time, barakah in my provision, and barakah in my relationships — let goodness multiply in everything I touch.",
  "O Allah, guard my tongue from hurtful words. When anger rises, grant me silence; when truth is needed, grant me courage; and when kindness is due, grant me warmth.",
  "O Allah, grant me contentment with what You have given me. Protect me from envy of others, and let me see the blessings I have been given with clear and grateful eyes.",
  "O Allah, relieve the hardship of the one in need through me. Use my hands for charity, my presence for comfort, and my resources for the sake of others.",
  "O Allah, let the Quran be the spring of my heart. Make it a light in my chest, a companion in my loneliness, and a guide in my actions and my choices.",
  "O Allah, grant me a good life, a good death, and Your meeting. Let the end of my story be better than its beginning, and let me meet You with a heart that loved You.",
  "O Allah, protect my faith until the day I meet You. Guard me from the slow decay of heedlessness, and keep my connection with You alive and growing every single day.",
  "O Allah, make me of those who pray on time and in congregation. Protect my prayers from distraction, and let my prayer be a source of rest and renewal for my soul.",
  "O Allah, in this day, grant me success in what pleases You. Guide my choices, bless my efforts, and let me end the day closer to You than I began it.",
  "O Allah, whatever I miss of good today, let me attain it tomorrow. Whatever I do of evil today, forgive it and replace it with good, for You are the Most Merciful of those who show mercy.",
];

export const WISDOM_QUOTES: { text: string; author: string }[] = [
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Your time is limited, so don't waste it living someone else's life.", author: "Steve Jobs" },
  { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { text: "Do not go where the path may lead; go instead where there is no path and leave a trail.", author: "Ralph Waldo Emerson" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "Whether you think you can or you think you can't, you're right.", author: "Henry Ford" },
  { text: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" },
  { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
  { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
  { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela" },
  { text: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
  { text: "If you want to lift yourself up, lift up someone else.", author: "Booker T. Washington" },
  { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { text: "Happiness is not something ready-made. It comes from your own actions.", author: "Dalai Lama" },
  { text: "The mind is everything. What you think you become.", author: "Buddha" },
  { text: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
  { text: "Small deeds done are better than great deeds planned.", author: "Peter Marshall" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Nothing great is ever achieved without enthusiasm.", author: "Ralph Waldo Emerson" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Turn your wounds into wisdom.", author: "Oprah Winfrey" },
  { text: "Courage is not the absence of fear, but the triumph over it.", author: "Nelson Mandela" },
];

export const MOTIVATIONAL_ADVICE: string[] = [
  "Start your day with one small task you can finish in five minutes. Momentum is built from tiny wins, and one completed task gives you the confidence to take the next step.",
  "You don't have to be perfect today — just a little better than yesterday. Growth is a slow climb, and every honest effort counts even when the progress is invisible.",
  "When the work feels heavy, break it down. One step, one hour, one page at a time. Great things are never built in a day, only one deliberate day at a time.",
  "Take a moment to breathe deeply before you react today. A pause between feeling and action is the difference between a regret and a wise decision.",
  "Don't wait to feel ready. Nobody ever does. Take the first imperfect step, and let the path reveal itself as you walk it.",
  "Your focus is your most valuable resource. Guard it fiercely — silence your phone for one hour and see how much more you can accomplish.",
  "Compare yourself only to who you were yesterday. The person beside you is on a different road; your only real competition is the version of you that gave up.",
  "If today feels heavy, lower the bar without lowering the goal. A small amount done consistently beats a grand plan abandoned by Tuesday.",
  "Speak to yourself the way you would speak to a friend. You would never call a friend a failure for struggling; don't say it to yourself either.",
  "One hour of focused work is worth four hours of distracted effort. Close the extra tabs, put the phone away, and give that one hour your whole self.",
  "When you don't know what to do, do the next right thing you can see. Clarity comes through action, not before it.",
  "Remember why you started. Write it down and keep it where you'll see it — motivation fades, but a written reason can bring it back.",
  "Progress is rarely a straight line. Detours, restarts, and slow seasons are all part of the road; what matters is that you keep moving.",
  "Ask for help when you need it. Strength is not doing everything alone; it is knowing when to lean on others and doing so without shame.",
  "Before you sleep tonight, write down three things that went well today. Gratitude practiced daily rewires the mind to see what is going right.",
  "You cannot change the first hour of the day, but you can change how you use the next one. It's never too late to turn the day around.",
  "Discipline is choosing what you want most over what you want now. Every small choice today is a vote for the person you want to become.",
  "Rest is not laziness. Your mind and body are tools that need sharpening; a short break now makes your next hours far more productive.",
  "Fear and excitement feel the same in the body. Tell yourself you're excited, not nervous, and step forward anyway.",
  "The best time to plant a tree was twenty years ago. The second best time is today. Whatever you've been postponing, this is your moment.",
  "Don't let a bad morning steal your whole day. What you do after a setback matters more than the setback itself.",
  "Make your environment work for you. Keep what you need visible, and what distracts you out of sight — willpower is easier when you don't have to use it.",
  "Learn to say no to good things so you can say yes to the best things. Every yes has a cost; spend your energy where it matters.",
  "You are not behind. You are on your own timeline, and timelines are not races. Move at the pace that lets you finish strong.",
  "Review your day for two minutes before bed: what went well, what didn't, and what you'll do differently. Small daily reviews compound into real change.",
  "When you feel stuck, change your environment or your body — walk, stretch, change rooms. A new angle often unlocks a new idea.",
  "Promise less and deliver more. Under-promising protects your relationships; over-delivering builds your reputation.",
  "Difficulty is not a sign to stop; it is a sign you are at the edge of your comfort zone, which is exactly where growth happens.",
  "Take care of the basics first: water, sleep, food, movement. A tired body cannot carry a motivated mind for long.",
  "Be gentle with your future self. Set tomorrow up for success tonight — prepare the clothes, the notes, the plan — and tomorrow's you will thank today's you.",
];

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

/** Different faith message every day — rotates through the verses/duas. */
export function faithMessage(
  date: Date,
  religion: "christian" | "muslim" | "other",
): FaithMessage | null {
  const idx = dayOfYear(date);
  if (religion === "christian") {
    const verse = BIBLE_VERSES[idx % BIBLE_VERSES.length];
    return {
      verse: verse.text,
      reference: verse.ref,
      message: PRAYERS[idx % PRAYERS.length],
    };
  }
  if (religion === "muslim") {
    const verse = QURAN_VERSES[idx % QURAN_VERSES.length];
    return {
      verse: verse.text,
      reference: verse.ref,
      message: DUAS[idx % DUAS.length],
    };
  }
  if (religion === "other") {
    const quote = WISDOM_QUOTES[idx % WISDOM_QUOTES.length];
    return {
      verse: quote.text,
      reference: quote.author,
      message: MOTIVATIONAL_ADVICE[idx % MOTIVATIONAL_ADVICE.length],
    };
  }
  return null;
}