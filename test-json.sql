SELECT 
  (SELECT json_group_array(json_object('avatar_url', u.avatar_url, 'badges', u.badges_json)) 
   FROM (SELECT users.avatar_url, users.badges_json FROM users LIMIT 3) u
  ) as participants_preview;
