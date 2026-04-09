-- Test rule: BONE_HEALTH → (add rule_actions separately to define which nutrients are required)
INSERT INTO public.rules (rule_name, trigger_type, trigger_node_id, priority, conflict_strategy, is_active)
VALUES ('test1', 'goal', 'bddb4e24-76a9-402a-96ce-6dee4a360a94', 2, 'accumulate', true)
ON CONFLICT (rule_name) DO NOTHING;
