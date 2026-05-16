INSERT INTO "users" (
  "id",
  "google_user_id",
  "email",
  "youtube_channel_id",
  "youtube_display_name",
  "youtube_handle",
  "avatar_url",
  "is_linked",
  "exclude_from_ranking",
  "created_at"
)
VALUES (
  'viewer_ludylops_featured',
  NULL,
  NULL,
  'system:ludylops-featured-creators',
  'Ludylops',
  NULL,
  NULL,
  false,
  true,
  now()
)
ON CONFLICT ("id") DO UPDATE SET
  "youtube_display_name" = EXCLUDED."youtube_display_name",
  "exclude_from_ranking" = true;
--> statement-breakpoint
DELETE FROM "creator_suggestion_boosts"
WHERE "suggestion_id" IN (
  SELECT "id"
  FROM "creator_suggestions"
  WHERE "status" = 'featured'
);
--> statement-breakpoint
DELETE FROM "creator_suggestions"
WHERE "status" = 'featured';
--> statement-breakpoint
INSERT INTO "creator_suggestions" (
  "id",
  "viewer_id",
  "slug",
  "name",
  "channel_url",
  "platform",
  "category",
  "reason",
  "status",
  "total_votes",
  "created_at",
  "updated_at"
)
VALUES
  (
    'cs-featured-brksedu',
    'viewer_ludylops_featured',
    'brksedu',
    'BRKsEDU',
    'https://www.youtube.com/@BRKsEDU',
    'youtube',
    'games',
    'Gameplay, carisma e repertório de jogos com aquele ritmo bom de acompanhar por horas.',
    'featured',
    1200,
    now(),
    now()
  ),
  (
    'cs-featured-cogumelando',
    'viewer_ludylops_featured',
    'cogumelando',
    'Cogumelando',
    'https://www.youtube.com/@cogumelando',
    'youtube',
    'videogame',
    'Olhar acolhedor e muito vivido sobre videogame, com carinho por história, descoberta e comunidade.',
    'featured',
    1190,
    now(),
    now()
  ),
  (
    'cs-featured-republica-coisa-de-nerd',
    'viewer_ludylops_featured',
    'republica-coisa-de-nerd',
    'República Coisa de Nerd',
    'https://www.youtube.com/@republicacoisadenerd',
    'youtube',
    'games e cultura pop',
    'Conteúdo de jogos com energia leve, conversa boa e uma sensação gostosa de acompanhar junto.',
    'featured',
    1180,
    now(),
    now()
  ),
  (
    'cs-featured-pablitto',
    'viewer_ludylops_featured',
    'pablitto',
    'Pablitto',
    'https://www.youtube.com/@pablitto',
    'youtube',
    'variedades',
    'Live com presença, improviso e aquela troca rápida que faz o chat virar parte do conteúdo.',
    'featured',
    1170,
    now(),
    now()
  ),
  (
    'cs-featured-funky-black-cat',
    'viewer_ludylops_featured',
    'funky-black-cat',
    'Funky Black Cat',
    'https://www.youtube.com/@funkyblackcat',
    'youtube',
    'games',
    'Gameplay brasileiro clássico, com personalidade forte e uma história gigante no YouTube de jogos.',
    'featured',
    1160,
    now(),
    now()
  ),
  (
    'cs-featured-pewdiepie',
    'viewer_ludylops_featured',
    'pewdiepie',
    'PewDiePie',
    'https://www.youtube.com/@PewDiePie',
    'youtube',
    'variedades',
    'Um dos grandes nomes da cultura de criadores, com fases diferentes e muita influência no formato.',
    'featured',
    1150,
    now(),
    now()
  ),
  (
    'cs-featured-striketps',
    'viewer_ludylops_featured',
    'striketps',
    'StrikeTPS',
    'https://www.youtube.com/@StrikeTPS',
    'youtube',
    'games',
    'Conteúdo de jogos com pegada direta, humor e boas referências para acompanhar gameplay.',
    'featured',
    1140,
    now(),
    now()
  ),
  (
    'cs-featured-coltydog',
    'viewer_ludylops_featured',
    'coltydog',
    'Coltydog',
    'https://www.youtube.com/@coltydog',
    'youtube',
    'lives',
    'Stream com ritmo próprio, comunidade presente e momentos que deixam a live com cara de encontro.',
    'featured',
    1130,
    now(),
    now()
  ),
  (
    'cs-featured-cellbit',
    'viewer_ludylops_featured',
    'cellbit',
    'Cellbit',
    'https://www.twitch.tv/cellbit',
    'twitch',
    'rpg e mistério',
    'Criação de mundos, mistério e narrativa com uma capacidade rara de transformar live em experiência.',
    'featured',
    1120,
    now(),
    now()
  ),
  (
    'cs-featured-maximizando',
    'viewer_ludylops_featured',
    'maximizando',
    'M4Ximizando',
    'https://www.youtube.com/m4ximizando',
    'youtube',
    'games',
    'Conteúdo para pensar jogo, estratégia e escolhas com uma pegada prática e fácil de acompanhar.',
    'featured',
    1110,
    now(),
    now()
  ),
  (
    'cs-featured-bagi',
    'viewer_ludylops_featured',
    'bagi',
    'Bagi',
    'https://www.twitch.tv/bagi',
    'twitch',
    'variedades e rpg',
    'Live com personalidade, presença forte e uma entrega que combina caos bom, afeto e narrativa.',
    'featured',
    1100,
    now(),
    now()
  ),
  (
    'cs-featured-beta-boechat',
    'viewer_ludylops_featured',
    'beta-boechat',
    'Beta Boechat',
    'https://www.youtube.com/@betaboechat',
    'youtube',
    'variedades',
    'Conteúdo com voz própria, boas conversas e um jeito sensível de olhar cultura, internet e pessoas.',
    'featured',
    1090,
    now(),
    now()
  ),
  (
    'cs-featured-debyte-podcast',
    'viewer_ludylops_featured',
    'debyte-podcast',
    'DeByte Podcast',
    'https://www.youtube.com/@debytepodcast',
    'youtube',
    'podcast de games',
    'Podcast sobre mídia, games, criação de conteúdo e tecnologia com conversa leve e bem informada.',
    'featured',
    1080,
    now(),
    now()
  );
