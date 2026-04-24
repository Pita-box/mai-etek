INSERT INTO achievements (name, description, points_required, tasks_required, condition_config) VALUES
('First Steps', 'Complete your first task', 0, 1, '{"type": "tasks", "threshold": 1}'::jsonb),
('Dedicated', 'Complete 10 tasks', 0, 10, '{"type": "tasks", "threshold": 10}'::jsonb),
('Unstoppable', 'Complete 50 tasks', 0, 50, '{"type": "tasks", "threshold": 50}'::jsonb),
('Centurion', 'Complete 100 tasks', 0, 100, '{"type": "tasks", "threshold": 100}'::jsonb),
('Perfect Score', 'Receive five perfect ratings', 0, 0, '{"type": "perfect_rating", "count": 5}'::jsonb),
('On Fire', 'Complete tasks for 7 days straight', 0, 0, '{"type": "streak", "threshold": 7}'::jsonb),
('Monthly Master', 'Complete tasks for 30 days straight', 0, 0, '{"type": "streak", "threshold": 30}'::jsonb),
('Point Collector', 'Accumulate 500 points', 500, 0, '{"type": "points", "threshold": 500}'::jsonb),
('High Roller', 'Accumulate 1000 points', 1000, 0, '{"type": "points", "threshold": 1000}'::jsonb),
('Level 5', 'Reach level 5', 0, 0, '{"type": "level", "threshold": 5}'::jsonb),
('Level 10', 'Reach level 10', 0, 0, '{"type": "level", "threshold": 10}'::jsonb);
