-- Stop complete_signup from auto-promoting users to 'player'.
-- New signups stay 'viewer' until an admin promotes them in the Users page.
CREATE OR REPLACE FUNCTION public.complete_signup(player_name text, player_gender text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_player_id uuid;
BEGIN
  INSERT INTO players (name, gender) VALUES (player_name, player_gender) RETURNING id INTO new_player_id;

  UPDATE user_roles
  SET player_id = new_player_id
  WHERE user_id = auth.uid();
END;
$$;
