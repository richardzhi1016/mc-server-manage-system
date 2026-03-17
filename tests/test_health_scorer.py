from app.services.health_scorer import compute_health_score, HealthGrade


class TestComputeHealthScore:
    def test_perfect_server(self):
        score = compute_health_score(tps=20.0, cpu_pct=5.0, memory_pct=20.0)
        assert score >= 90

    def test_lagging_server_scores_low(self):
        score = compute_health_score(tps=5.0, cpu_pct=95.0, memory_pct=95.0)
        assert score < 40

    def test_vanilla_neutral_tps(self):
        # Vanilla servers have no TPS; neutral value (70) is substituted
        score_with_tps = compute_health_score(tps=None, cpu_pct=20.0, memory_pct=30.0)
        score_explicit = compute_health_score(tps=14.0, cpu_pct=20.0, memory_pct=30.0)
        # Neutral substitution (70) roughly equals tps=14/20*100=70 — within a few points
        assert abs(score_with_tps - score_explicit) < 5

    def test_tps_clamped_at_20(self):
        # tps > 20 should not give bonus above 100
        score = compute_health_score(tps=25.0, cpu_pct=5.0, memory_pct=5.0)
        assert score <= 100

    def test_grade_green(self):
        assert HealthGrade.from_score(90) == HealthGrade.GREEN

    def test_grade_yellow(self):
        assert HealthGrade.from_score(70) == HealthGrade.YELLOW

    def test_grade_red(self):
        assert HealthGrade.from_score(45) == HealthGrade.RED
