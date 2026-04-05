ALTER TABLE v3_composite_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE v3_feature_state_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE v3_state_diagnosis_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to v3_composite_states" ON v3_composite_states FOR SELECT USING (true);
CREATE POLICY "Allow read access to v3_feature_state_mappings" ON v3_feature_state_mappings FOR SELECT USING (true);
CREATE POLICY "Allow read access to v3_state_diagnosis_mappings" ON v3_state_diagnosis_mappings FOR SELECT USING (true);