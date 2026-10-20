/* Single source of truth for starter data. Used by the browser (demo mode) AND the API (first-run DB seed). */
(function (f) {
  const r = f();
  typeof module !== "undefined" ? (module.exports = r) : (window.SEED = r);
})(() => {
  const W = ["peach", "dusk", "lilac", "moss", "ember", "night"],
    A = ["#e07a5f", "#6a8caf", "#8e7dbe", "#5f9e6e", "#d4a017", "#c95d8a"];
  // [display name, image slug (img/users/<slug>.png), admin?]   — password defaults to the lowercase display name
  const roster = [
    ["David", "david", 1],
    ["Shelly", "shelly"],
    ["Nelly", "nelly"],
    ["Beckham", "beckham"],
    ["Ted", "ted"],
    ["Claire", "claire"],
    ["Violet", "violet"],
    ["Sharon", "sharon"],
    ["Michael", "michael"],
    ["Mercy", "mercy"],
    ["Njeri", "njeri"],
  ];
  return {
    users: roster.map(([name, slug, admin], i) => ({
      name,
      slug,
      admin: admin ? 1 : 0,
      avatar: `img/users/${slug}.png`,
      wallpaper: W[i % 6],
      accent: A[i % 6],
    })),
    hangouts: [
      {
        title: "Backyard Cookout",
        date: "2026-08-15",
        place: "Dave's place",
        who: "Everyone",
        emoji: "🍖",
        story:
          "The grill was lit by 2pm and nobody left until midnight. Nyama choma, way too much ugali, and a charcoal-lighting contest that Wayne lost and still ate first. We ended around the fire with a speaker and terrible singing.",
        media: [
          { e: "🔥", caption: "Fire lit, 2:04pm" },
          { e: "🍖", caption: "The spread" },
          { e: "🎶", caption: "Fireside singing", video: 1 },
        ],
      },
      {
        title: "Movie Theater Night",
        date: "2026-09-05",
        place: "Cinema, Westlands",
        who: "6 of us",
        emoji: "🎬",
        story:
          "We booked the back row for the late show. Popcorn was shared (read: stolen), a phone rang in the quietest scene, and the debate about the ending outlasted the film.",
        media: [
          { e: "🎟️", caption: "Tickets in hand" },
          { e: "🍿", caption: "Popcorn heist" },
          { e: "🌃", caption: "Walking out, debating" },
        ],
      },
      {
        title: "Murder Mystery Night",
        date: "2026-09-26",
        place: "Living room",
        who: "8 suspects",
        emoji: "🕵️",
        story:
          "Everyone got a character card and a secret. The butler lied beautifully for two rounds. The culprit was revealed at 11:40pm and half the room refused to believe it. Rematch demanded.",
        media: [
          { e: "🕵️", caption: "Cards dealt" },
          { e: "🔍", caption: "Interrogation round" },
          { e: "🎭", caption: "The big reveal", video: 1 },
        ],
      },
    ],
    notes: [
      { kind: "📍 Place", text: "Hell's Gate day trip" },
      { kind: "🎯 Activity", text: "Go-karting tournament" },
      { kind: "🎯 Activity", text: "Karaoke night" },
    ],
  };
});
