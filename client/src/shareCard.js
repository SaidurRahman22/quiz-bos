// Generate a branded square score card image and share it (Web Share API with a file),
// falling back to a plain share, then to downloading the PNG + copying the text.

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function scoreMessage(pct) {
  if (pct >= 90) return 'Outstanding! 🏆';
  if (pct >= 70) return 'Great job! 🎉';
  if (pct >= 50) return 'Good effort! 👍';
  return 'Keep practising! 💪';
}

function drawCard(ctx, W, H, { topicName, topicIcon, score, total, pct }) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#6366f1');
  grad.addColorStop(0.5, '#8b5cf6');
  grad.addColorStop(1, '#ec4899');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // translucent inner panel
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  roundRect(ctx, 70, 70, W - 140, H - 140, 56);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';

  ctx.font = '150px "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.fillText(topicIcon || '🧠', W / 2, 330);

  // topic name — shrink if long
  let nameSize = 66;
  ctx.font = `bold ${nameSize}px sans-serif`;
  while (ctx.measureText(topicName).width > W - 220 && nameSize > 34) {
    nameSize -= 4;
    ctx.font = `bold ${nameSize}px sans-serif`;
  }
  ctx.fillText(topicName, W / 2, 430);

  ctx.font = 'bold 300px sans-serif';
  ctx.fillText(`${pct}%`, W / 2, 760);

  ctx.font = '56px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(`${score} / ${total} correct`, W / 2, 850);

  ctx.font = 'bold 54px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(scoreMessage(pct), W / 2, 936);

  ctx.font = 'bold 46px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('🧠 Quiz Boss', W / 2, 1012);
}

// Returns 'shared' | 'downloaded' | 'cancelled' | 'unsupported'.
export async function shareScoreCard({ topicName, topicIcon, score, total }) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  const text = `I scored ${score}/${total} (${pct}%) on ${topicName} in Quiz Boss! 🎯`;
  const url = typeof window !== 'undefined' ? window.location.origin : '';

  let blob = null;
  try {
    const W = 1080;
    const H = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    drawCard(ctx, W, H, { topicName, topicIcon, score, total, pct });
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  } catch {
    blob = null;
  }

  // 1. Share the image itself (best on mobile).
  if (blob && typeof File !== 'undefined' && navigator.canShare) {
    const file = new File([blob], 'quizboss-score.png', { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text, title: 'My Quiz Boss score' });
        return 'shared';
      } catch (err) {
        if (err && err.name === 'AbortError') return 'cancelled';
      }
    }
  }

  // 2. Plain text/link share.
  if (navigator.share) {
    try {
      await navigator.share({ title: 'My Quiz Boss score', text, url });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
    }
  }

  // 3. Fallback: download the image and copy the caption.
  if (blob) {
    try {
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = 'quizboss-score.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      /* ignore */
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`.trim());
  } catch {
    /* clipboard may be unavailable */
  }
  return blob ? 'downloaded' : 'unsupported';
}
