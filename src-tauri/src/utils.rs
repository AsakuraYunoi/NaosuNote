pub fn levenshtein_similarity(s1: &str, s2: &str) -> f64 {
    let c1: Vec<char> = s1.chars().collect();
    let c2: Vec<char> = s2.chars().collect();

    let len1 = c1.len();
    let len2 = c2.len();

    if len1 == 0 && len2 == 0 {
        return 1.0;
    }
    if len1 == 0 || len2 == 0 {
        return 0.0;
    }

    let mut dp = vec![vec![0usize; len2 + 1]; len1 + 1];

    for i in 0..=len1 {
        dp[i][0] = i;
    }
    for j in 0..=len2 {
        dp[0][j] = j;
    }

    for i in 1..=len1 {
        for j in 1..=len2 {
            let cost = if c1[i - 1] == c2[j - 1] { 0 } else { 1 };
            dp[i][j] = (dp[i - 1][j] + 1)
                .min(dp[i][j - 1] + 1)
                .min(dp[i - 1][j - 1] + cost);
        }
    }

    let distance = dp[len1][len2];
    let max_len = len1.max(len2);
    1.0 - (distance as f64 / max_len as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_similarity() {
        assert_eq!(levenshtein_similarity("abcdef", "abcdef"), 1.0);
        assert!(levenshtein_similarity("硫酸钡焙烧", "硫酸钡浸取焙烧") > 0.6);
    }
}
