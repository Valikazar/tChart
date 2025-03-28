export const generateData = (count: number): [number, number, number, number, number][] => {
  const data: [number, number, number, number, number][] = [];
  const now = Date.now();
  let currentPrice = 100;

  for (let i = 0; i < count; i++) {
    const timestamp = now - (count - i - 1) * 3600 * 1000; // Каждый бар через час
    const open = currentPrice;
    const close = open + (Math.random() - 0.5) * 20;
    const high = Math.max(open, close) + Math.random() * 10;
    const low = Math.min(open, close) - Math.random() * 10;
    
    data.push([timestamp, open, high, low, close]);
    currentPrice = close;
  }

  return data;
}; 