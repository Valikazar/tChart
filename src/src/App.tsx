const testData: OHLCVData[] = JSON.parse(`{"data":{"attributes":{"ohlcv_list":[[1742025600,4.59971865629712e-05,4.59971865629712e-05,4.28810713558897e-05,4.31926525654683e-05,170.88151464031168],...]}}}`)
  .data.attributes.ohlcv_list
  .map(([timestamp, open, high, low, close, volume]: [number, number, number, number, number, number]) => ({
    timestamp,
    open,
    high,
    low,
    close,
    volume,
  })); 