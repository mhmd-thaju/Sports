-- Set the new Games points for every existing Games event and its default.
update public.tournament_config
set category_points = jsonb_set(
  coalesce(category_points, '{}'::jsonb),
  '{Games}',
  '[10,6,0]'::jsonb,
  true
), updated_at = now()
where id = 'current';

update public.events
set points = array[10, 6, 0]
where category = 'Games';
