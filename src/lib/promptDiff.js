// Line-by-line diff using LCS (Longest Common Subsequence)
export function diffLines(before, after) {
  const a = before.split('\n')
  const b = after.split('\n')
  const m = a.length
  const n = b.length

  // Build full DP table for LCS
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Backtrack to build result
  const result = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: 'equal', content: a[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', content: b[j - 1] })
      j--
    } else {
      result.unshift({ type: 'removed', content: a[i - 1] })
      i--
    }
  }
  return result
}

export function diffStats(diffResult) {
  return {
    added: diffResult.filter(d => d.type === 'added').length,
    removed: diffResult.filter(d => d.type === 'removed').length,
  }
}

export function hasDiff(diffResult) {
  return diffResult.some(d => d.type !== 'equal')
}
