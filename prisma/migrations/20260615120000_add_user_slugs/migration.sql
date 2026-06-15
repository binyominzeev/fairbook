ALTER TABLE "User" ADD COLUMN "slug" TEXT;

UPDATE "User"
SET "slug" = substr(
  trim(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(
                          replace(
                            replace(
                              replace(
                                replace(
                                  replace(
                                    replace(
                                      replace(lower("name"), 'á', 'a'),
                                      'é', 'e'
                                    ),
                                    'í', 'i'
                                  ),
                                  'ó', 'o'
                                ),
                                'ö', 'o'
                              ),
                              'ő', 'o'
                            ),
                            'ú', 'u'
                          ),
                          'ü', 'u'
                        ),
                        'ű', 'u'
                      ),
                      ' ', '-'
                    ),
                    '.', '-'
                  ),
                  ',', '-'
                ),
                '/', '-'
              ),
              '\\', '-'
            ),
            '"', '-'
          ),
          '''', '-'
        ),
        '!', '-'
      ),
      '?', '-'
    ),
    '-'
  ) || '-' || substr("id", 1, 6),
  1,
  64
)
WHERE "slug" IS NULL;

CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");