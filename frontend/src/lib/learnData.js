export const learnContent = [
  {
    id: "fno-basics",
    title: "1. The FnO Basics",
    summary: "What are Futures & Options? Understand CE/PE and the mechanics of the NIFTY option chain.",
    content: [
      {
        type: "p",
        text: "Futures and Options (FnO) are derivative instruments. Their value is derived from an underlying asset—in our case, indices like NIFTY 50, Bank NIFTY, or Finnifty.",
      },
      {
        type: "h4",
        text: "Calls (CE) vs Puts (PE)",
      },
      {
        type: "p",
        text: "Options give you the right to buy or sell the index at a specific price (the strike price).",
      },
      {
        type: "ul",
        items: [
          "Call Option (CE): You expect the market to go UP. If NIFTY rises, the CE premium increases.",
          "Put Option (PE): You expect the market to go DOWN. If NIFTY falls, the PE premium increases.",
        ],
      },
      {
        type: "h4",
        text: "Lot Sizes",
      },
      {
        type: "p",
        text: "You cannot buy a single share of an index. You must buy in 'lots'. Note that SEBI occasionally revises lot sizes.",
      },
      {
        type: "ul",
        items: [
          "NIFTY 50: 65 qty per lot",
          "Bank NIFTY: 30 qty per lot",
          "Finnifty: 60 qty per lot",
        ],
      },
    ],
  },
  {
    id: "greeks",
    title: "2. The Greeks (Simplified)",
    summary: "How Delta, Theta, and Vega affect option premiums before expiry.",
    content: [
      {
        type: "p",
        text: "Option premiums are not just driven by the price of the index. They are priced using a mathematical model governed by 'The Greeks'.",
      },
      {
        type: "h4",
        text: "Delta (Direction)",
      },
      {
        type: "p",
        text: "Delta measures how much the option premium changes for a 1-point move in the underlying index. In-the-money (ITM) options have a higher delta (move faster) than Out-of-the-money (OTM) options.",
      },
      {
        type: "h4",
        text: "Theta (Time Decay)",
      },
      {
        type: "p",
        text: "Options are decaying assets. Theta measures how much value the option loses each day just by time passing. This decay accelerates dramatically on Expiry Day.",
      },
      {
        type: "h4",
        text: "Vega (Volatility)",
      },
      {
        type: "p",
        text: "Vega measures sensitivity to implied volatility (IV). If the market panics (VIX spikes), option premiums inflate. If the market calms, premiums deflate, even if the index price hasn't moved.",
      },
    ],
  },
  {
    id: "methodology",
    title: "3. The Tradeflow Methodology",
    summary: "How the Pre-Market Analysis scoring dictates your playbook.",
    content: [
      {
        type: "p",
        text: "Tradeflow isn't a signal bot. It calculates a Macro Bias Score based on overnight global cues before the Indian market opens at 9:15 AM.",
      },
      {
        type: "h4",
        text: "What we score",
      },
      {
        type: "ul",
        items: [
          "GIFT Nifty: The primary indicator for the Indian open.",
          "US Markets (Nasdaq/S&P): Sets the global risk tone.",
          "VIX (Volatility): High VIX means fear (bearish), low VIX means complacency.",
          "DXY (Dollar Index) & Crude Oil: Inverse relationship with Indian equities. If Dollar/Oil spikes, NIFTY usually bleeds.",
        ],
      },
      {
        type: "p",
        text: "A highly positive score (>0.30) means strong bullish tailwinds. A highly negative score (<-0.30) indicates a bearish drag. If the score contradicts the live price action, tread carefully.",
      },
    ],
  },
  {
    id: "risk",
    title: "4. Risk Management & Stop Loss",
    summary: "Why we prioritize process over profit, and why SL is mandatory.",
    content: [
      {
        type: "p",
        text: "Tradeflow awards XP for setting a stop loss, writing a thesis, and reviewing mentor reports. It awards 0 XP for making a profit. This is intentional.",
      },
      {
        type: "h4",
        text: "The Hard Stop",
      },
      {
        type: "p",
        text: "You cannot open a paper trade in Tradeflow without setting a Stop Loss. A trade without a stop loss is a gamble, not a trade. If you move your stop loss mid-trade, you are lying to yourself.",
      },
      {
        type: "h4",
        text: "The Revenge Trade",
      },
      {
        type: "p",
        text: "If you take a loss and immediately open a new trade within 5 minutes, Tradeflow detects a 'Revenge Trade' and slaps you with a -25 XP penalty. Walk away, cool down, and wait for the next setup.",
      },
    ],
  },
];
