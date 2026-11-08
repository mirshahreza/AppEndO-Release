-- Base Info display helpers for reporting / edge SQL (PostgreSQL).
-- Requires: base_info, base_info_culture_text, base_info_title_path.

CREATE OR REPLACE FUNCTION zz_normalize_base_info_culture_id(culture_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(culture_id))
    WHEN 'en' THEN 'us'
    WHEN 'en-us' THEN 'us'
    WHEN 'fa' THEN 'ir'
    WHEN 'fa-ir' THEN 'ir'
    WHEN 'ar' THEN 'iq'
    WHEN 'ar-iq' THEN 'iq'
    WHEN 'us' THEN 'us'
    WHEN 'ir' THEN 'ir'
    WHEN 'iq' THEN 'iq'
    ELSE 'us'
  END;
$$;

CREATE OR REPLACE FUNCTION zz_base_info_display_title(culture_id text, base_info_id text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(trim(ct.title), ''),
    nullif(trim(bi.title), ''),
    bi.id
  )
  FROM base_info AS bi
  LEFT JOIN base_info_culture_text AS ct
    ON ct.base_info_id = bi.id
   AND ct.culture_id = zz_normalize_base_info_culture_id(culture_id)
  WHERE bi.id = base_info_id;
$$;

CREATE OR REPLACE FUNCTION zz_base_info_display_title_by_short_name(culture_id text, short_name text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT zz_base_info_display_title(culture_id, bi.id)
  FROM base_info AS bi
  WHERE bi.short_name = short_name
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION zz_base_info_path_take_depth(path text, depth integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  trimmed text;
  sep text := ' | ';
  parts text[];
  n integer;
  start_idx integer;
BEGIN
  trimmed := nullif(trim(path), '');
  IF trimmed IS NULL THEN
    RETURN NULL;
  END IF;
  IF depth IS NULL OR depth <= 0 THEN
    RETURN trimmed;
  END IF;

  parts := string_to_array(trimmed, sep);
  n := coalesce(array_length(parts, 1), 0);
  IF n = 0 THEN
    RETURN trimmed;
  END IF;
  IF depth >= n THEN
    RETURN trimmed;
  END IF;

  start_idx := n - depth + 1;
  RETURN array_to_string(parts[start_idx:n], sep);
END;
$$;

/**
 * depth: segment count from the node upward (leaf included). NULL or <= 0 = full path to root.
 */
CREATE OR REPLACE FUNCTION zz_base_info_display_title_path(
  culture_id text,
  base_info_id text,
  depth integer DEFAULT NULL
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT zz_base_info_path_take_depth(
    (
      SELECT nullif(trim(p.title_path), '')
      FROM base_info_title_path AS p
      WHERE p.base_info_id = base_info_id
        AND p.culture_id = zz_normalize_base_info_culture_id(culture_id)
    ),
    depth
  );
$$;

CREATE OR REPLACE FUNCTION zz_base_info_display_title_path_by_short_name(
  culture_id text,
  short_name text,
  depth integer DEFAULT NULL
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT zz_base_info_display_title_path(culture_id, bi.id, depth)
  FROM base_info AS bi
  WHERE bi.short_name = short_name
  LIMIT 1;
$$;
