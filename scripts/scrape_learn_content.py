"""
Tradeflow Academy — Educational Content Generator & Scraper Script

Scrapes and structures open educational FnO content (including Zerodha Varsity public modules
and open Indian trading education references) into 6 comprehensive course modules with 24 detailed topics.

Generates: frontend/src/lib/learnData.js
"""

import json
import os
import re
import urllib.request

MODULES = [
    {
        "id": "module-1",
        "number": 1,
        "title": "Introduction to Stock Markets & Index Trading",
        "description": "Understand how the Indian stock market functions, market regulators, indices (NIFTY 50, BankNifty), and market sessions.",
        "icon": "TrendingUp",
        "topics": [
            {
                "id": "market-basics",
                "title": "1.1 How Stock Exchanges & NSE Work",
                "summary": "The role of NSE, BSE, SEBI regulation, and clearing houses in Indian capital markets.",
                "readTime": "4 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "The National Stock Exchange (NSE) and Bombay Stock Exchange (BSE) are the primary stock exchanges in India. SEBI (Securities and Exchange Board of India) acts as the regulator ensuring transparency and protecting retail investor interests."
                    },
                    {
                        "type": "h4",
                        "text": "Key Pillars of Indian Markets"
                    },
                    {
                        "type": "ul",
                        "items": [
                            "Exchange (NSE/BSE): Provides the electronic limit order book matching buyers and sellers.",
                            "Depositories (NSDL/CDSL): Holds shares electronically in Demat format.",
                            "Clearing Corporation (NSE Clearing / NCL): Guarantees settlement so counterparty default risk is zero.",
                            "Brokers: Registered intermediaries providing API/platform access to retail traders."
                        ]
                    },
                    {
                        "type": "callout",
                        "style": "tip",
                        "title": "Pro Tip",
                        "text": "In India, T+1 settlement is active for equities. However, FnO profits and losses are settled mark-to-market daily by 3:30 PM IST."
                    }
                ],
                "takeaway": [
                    "SEBI regulates all Indian brokers and exchanges.",
                    "NSE Clearing guarantees that your trades will settle without counterparty risk.",
                    "FnO trades are settled daily on a mark-to-market basis."
                ]
            },
            {
                "id": "index-fundamentals",
                "title": "1.2 Understanding Benchmark Indices: NIFTY 50 & Bank NIFTY",
                "summary": "How free-float market capitalization weights indices and how NIFTY 50 serves as India's economic barometer.",
                "readTime": "5 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "A stock market index is a basket of top companies selected by market capitalization and liquidity. NIFTY 50 represents the top 50 blue-chip companies listed on NSE across 13 sectors."
                    },
                    {
                        "type": "h4",
                        "text": "Major Indian Indices Traded in FnO"
                    },
                    {
                        "type": "ul",
                        "items": [
                            "NIFTY 50: Top 50 companies (Heavyweights: HDFC Bank, Reliance, ICICI Bank, Infosys, TCS).",
                            "BANK NIFTY: Top 12 banking stocks in India. Highly volatile and liquid.",
                            "FINNIFTY: Financial services basket (Banks, Insurance, NBFCs, Housing Finance).",
                            "NIFTY IT: Top 10 Indian information technology exporters."
                        ]
                    },
                    {
                        "type": "callout",
                        "style": "takeaway",
                        "title": "Market Impact",
                        "text": "HDFC Bank and Reliance Industries together constitute over 25% of NIFTY 50's total weight. Significant moves in these two stocks heavily influence the entire index."
                    }
                ],
                "takeaway": [
                    "NIFTY 50 is weighted by free-float market capitalization.",
                    "HDFC Bank and Reliance carry the highest weights in NIFTY 50.",
                    "BankNifty moves faster and exhibits higher intraday volatility than NIFTY."
                ]
            },
            {
                "id": "market-timings",
                "title": "1.3 Indian Market Timings & Trading Sessions",
                "summary": "Pre-open session, normal trading hours (9:15 AM - 3:30 PM IST), and auto-squareoff rules.",
                "readTime": "3 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "Trading in Indian equities and derivatives follows a strict timetable on weekdays (Monday to Friday, excluding NSE market holidays)."
                    },
                    {
                        "type": "h4",
                        "text": "Trading Session Breakdown (IST)"
                    },
                    {
                        "type": "ul",
                        "items": [
                            "9:00 AM - 9:08 AM: Pre-open order collection session (discovers opening price).",
                            "9:08 AM - 9:15 AM: Order matching & buffer window.",
                            "9:15 AM - 3:30 PM: Normal continuous trading window for Cash and FnO.",
                            "3:15 PM: Standard intraday broker auto-squareoff deadline.",
                            "3:30 PM - 4:00 PM: Post-closing session (calculates closing price)."
                        ]
                    },
                    {
                        "type": "callout",
                        "style": "warning",
                        "title": "Auto-Squareoff Rule",
                        "text": "Intraday option trades must be closed before 3:15 PM IST. Holding in-the-money options to expiry subjects you to STT penalties and physical delivery obligations for stock options."
                    }
                ],
                "takeaway": [
                    "Normal market hours run strictly from 9:15 AM to 3:30 PM IST.",
                    "Intraday FnO paper trades auto-squareoff at 3:15 PM IST.",
                    "Overnight gap risk happens between 3:30 PM close and 9:15 AM next-day open."
                ]
            },
            {
                "id": "gift-nifty-premarket",
                "title": "1.4 GIFT Nifty & Global Pre-Market Cues",
                "summary": "Why GIFT Nifty (formerly SGX Nifty) acts as the premier 24-hour lead indicator for NIFTY's opening gap.",
                "readTime": "5 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "GIFT Nifty (trading at GIFT City, Gujarat) is an international futures contract benchmarked to NIFTY 50. It trades nearly 21 hours a day across Asian, European, and US market hours."
                    },
                    {
                        "type": "h4",
                        "text": "How Pre-Market Gap Analysis Works"
                    },
                    {
                        "type": "p",
                        "text": "If US markets (Nasdaq / S&P 500) rally overnight, GIFT Nifty trades higher. The difference between yesterday's NIFTY 50 cash close and today's GIFT Nifty trading price at 8:00 AM IST gives the expected Gap Up or Gap Down points."
                    },
                    {
                        "type": "callout",
                        "style": "tip",
                        "title": "Tradeflow Integration",
                        "text": "Tradeflow scans GIFT Nifty at 8:00 AM IST alongside US VIX, DXY, Crude, and Nasdaq to generate your daily quantitative bias score before 9:15 AM."
                    }
                ],
                "takeaway": [
                    "GIFT Nifty trades almost 21 hours daily, reflecting overnight global news.",
                    "Comparing GIFT Nifty to NIFTY cash close predicts the opening gap.",
                    "Overnight global cues heavily dictate the first 15 minutes of price action."
                ]
            }
        ]
    },
    {
        "id": "module-2",
        "number": 2,
        "title": "Futures & Options Core Mechanics",
        "description": "Master Call (CE) vs Put (PE) options, strike selection, ITM/ATM/OTM moneyness, and SEBI lot sizes.",
        "icon": "Layers",
        "topics": [
            {
                "id": "calls-and-puts",
                "title": "2.1 Call Options (CE) vs Put Options (PE)",
                "summary": "The fundamental difference between buying rights to buy (Call) and rights to sell (Put).",
                "readTime": "5 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "An option is a contract that gives the buyer the right—but not the obligation—to buy or sell an underlying index/stock at a fixed price (Strike Price) on or before a specified date (Expiry)."
                    },
                    {
                        "type": "h4",
                        "text": "Call Option (CE — European Call)"
                    },
                    {
                        "type": "p",
                        "text": "When you buy a Call (CE), you are bullish. You profit if the underlying index rises significantly above your entry price."
                    },
                    {
                        "type": "h4",
                        "text": "Put Option (PE — European Put)"
                    },
                    {
                        "type": "p",
                        "text": "When you buy a Put (PE), you are bearish. You profit if the underlying index falls significantly below your entry price."
                    },
                    {
                        "type": "callout",
                        "style": "takeaway",
                        "title": "Buyer vs Seller Asymmetry",
                        "text": "Option Buyer: Limited risk (maximum loss = premium paid), unlimited upside potential.\nOption Seller (Writer): Unlimited risk, limited upside (maximum profit = premium collected)."
                    }
                ],
                "takeaway": [
                    "CE = Bullish bet (Index UP -> CE Premium UP).",
                    "PE = Bearish bet (Index DOWN -> PE Premium UP).",
                    "Option buyers pay a premium to limit risk to the upfront cost."
                ]
            },
            {
                "id": "moneyness-itm-atm-otm",
                "title": "2.2 Moneyness: ITM, ATM, and OTM Strike Prices",
                "summary": "Understanding In-The-Money, At-The-Money, and Out-Of-The-Money strikes on the NIFTY option chain.",
                "readTime": "6 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "Moneyness describes the relationship between the current spot price of NIFTY 50 and the strike price of an option."
                    },
                    {
                        "type": "h4",
                        "text": "Call Option (CE) Moneyness"
                    },
                    {
                        "type": "ul",
                        "items": [
                            "ITM (In-The-Money): Strike < Spot Price (e.g. 24,000 CE when Spot is 24,150). Has intrinsic value + time value.",
                            "ATM (At-The-Money): Strike == Spot Price (e.g. 24,150 CE when Spot is 24,150). Maximum time decay rate.",
                            "OTM (Out-Of-The-Money): Strike > Spot Price (e.g. 24,300 CE when Spot is 24,150). Zero intrinsic value, pure time value."
                        ]
                    },
                    {
                        "type": "h4",
                        "text": "Put Option (PE) Moneyness"
                    },
                    {
                        "type": "ul",
                        "items": [
                            "ITM (In-The-Money): Strike > Spot Price (e.g. 24,300 PE when Spot is 24,150). Has intrinsic value.",
                            "ATM (At-The-Money): Strike == Spot Price (e.g. 24,150 PE when Spot is 24,150).",
                            "OTM (Out-Of-The-Money): Strike < Spot Price (e.g. 24,000 PE when Spot is 24,150). Zero intrinsic value."
                        ]
                    },
                    {
                        "type": "callout",
                        "style": "tip",
                        "title": "Retail Trader Rule",
                        "text": "Buying deep OTM options (the '₹5-₹10 lottery tickets') is a losing strategy due to rapid Theta decay. Professional traders stick to ITM or slightly OTM strikes."
                    }
                ],
                "takeaway": [
                    "ITM options carry intrinsic value and track index moves faster.",
                    "OTM options contain zero intrinsic value and expire worthless at 0 if index doesn't cross strike.",
                    "ATM options decay the fastest as expiry approaches."
                ]
            },
            {
                "id": "lot-sizes-and-expiries",
                "title": "2.3 SEBI Lot Sizes & Weekly Expiry Cycles",
                "summary": "Official SEBI contract lot sizes and Thursday weekly / monthly expiry schedules.",
                "readTime": "4 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "In Indian FnO markets, options cannot be traded in single quantity units. You trade standardized contract bundles called 'Lots'."
                    },
                    {
                        "type": "h4",
                        "text": "Verified SEBI Contract Lot Sizes"
                    },
                    {
                        "type": "ul",
                        "items": [
                            "NIFTY 50: 65 quantity per lot (1 Lot = 65 units).",
                            "BANK NIFTY: 30 quantity per lot (1 Lot = 30 units).",
                            "FINNIFTY: 60 quantity per lot (1 Lot = 60 units)."
                        ]
                    },
                    {
                        "type": "h4",
                        "text": "Expiry Schedules"
                    },
                    {
                        "type": "p",
                        "text": "NIFTY options expire every Thursday. If Thursday is a trading holiday, expiry shifts to Wednesday."
                    },
                    {
                        "type": "callout",
                        "style": "warning",
                        "title": "Premium Outlay Calculation",
                        "text": "If NIFTY 24,150 CE premium is ₹100, purchasing 1 lot (65 units) requires an outlay of ₹100 x 65 = ₹6,500."
                    }
                ],
                "takeaway": [
                    "NIFTY lot size is 65 units per lot.",
                    "Total capital outlay = Premium Price x Lot Quantity.",
                    "Weekly options expire every Thursday at 3:30 PM IST."
                ]
            },
            {
                "id": "reading-option-chain",
                "title": "2.4 How to Read the NIFTY Option Chain",
                "summary": "Analyzing Open Interest (OI), Volume, IV, and the Put-Call Ratio (PCR).",
                "readTime": "6 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "An Option Chain displays all active strike prices with Call data on the left and Put data on the right."
                    },
                    {
                        "type": "h4",
                        "text": "Key Option Chain Metrics"
                    },
                    {
                        "type": "ul",
                        "items": [
                            "Open Interest (OI): Total outstanding option contracts held by market participants. High Call OI acts as Resistance; High Put OI acts as Support.",
                            "Change in OI: Intraday additions or unwinding of positions.",
                            "Implied Volatility (IV): Market expectation of future price volatility.",
                            "Put-Call Ratio (PCR): Total Put OI divided by Total Call OI across all strikes."
                        ]
                    },
                    {
                        "type": "callout",
                        "style": "takeaway",
                        "title": "PCR Rule of Thumb",
                        "text": "PCR > 1.2: Heavy Put writing (Bullish support / institutional hedging).\nPCR 0.8 - 1.2: Neutral market range.\nPCR < 0.8: Heavy Call writing (Bearish resistance / capped upside)."
                    }
                ],
                "takeaway": [
                    "High Call OI indicates market resistance level.",
                    "High Put OI indicates market support level.",
                    "PCR > 1.2 signifies bullish undertone; PCR < 0.8 signifies bearish pressure."
                ]
            }
        ]
    },
    {
        "id": "module-3",
        "number": 3,
        "title": "Option Pricing & The Greeks",
        "description": "Understand Delta, Theta decay, Vega volatility spikes, Gamma accelerations, and intrinsic vs extrinsic value.",
        "icon": "Activity",
        "topics": [
            {
                "id": "greeks-delta",
                "title": "3.1 Delta: Directional Speed Meter",
                "summary": "How Delta predicts option premium movement per 1-point move in NIFTY.",
                "readTime": "5 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "Delta measures the rate of change of an option's premium with respect to a 1-point change in the price of NIFTY."
                    },
                    {
                        "type": "h4",
                        "text": "Delta Ranges"
                    },
                    {
                        "type": "ul",
                        "items": [
                            "ATM Call Delta ~ 0.50: If NIFTY rises 10 points, ATM Call premium rises by ~₹5.00.",
                            "Deep ITM Call Delta ~ 0.80 - 0.95: Moves almost 1-to-1 with NIFTY cash index.",
                            "Far OTM Call Delta ~ 0.10 - 0.20: Moves slowly; requires massive index move to gain value."
                        ]
                    },
                    {
                        "type": "callout",
                        "style": "tip",
                        "title": "Delta Choice for Intraday Traders",
                        "text": "Intraday option buyers should select strike prices with Delta between 0.50 and 0.70 (ATM or slightly ITM) to capture crisp directional momentum."
                    }
                ],
                "takeaway": [
                    "Delta measures price sensitivity to index moves.",
                    "ATM Call options have ~0.50 Delta.",
                    "ITM options have higher Delta and track index moves faster."
                ]
            },
            {
                "id": "greeks-theta",
                "title": "3.2 Theta: The Option Buyer's Silent Enemy",
                "summary": "Understanding time decay acceleration and why options lose value every passing minute.",
                "readTime": "6 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "Theta represents the rate of time decay of an option contract. As time passes, the probability of an option expiring in-the-money decreases, reducing its extrinsic value."
                    },
                    {
                        "type": "h4",
                        "text": "The Expiry Decay Curve"
                    },
                    {
                        "type": "p",
                        "text": "Time decay is non-linear. It accelerates exponentially in the final 72 hours before Thursday expiry."
                    },
                    {
                        "type": "callout",
                        "style": "warning",
                        "title": "Overnight Theta Risk",
                        "text": "Holding OTM options overnight erodes 15% - 40% of their premium value purely due to overnight Theta decay, even if NIFTY opens flat!"
                    }
                ],
                "takeaway": [
                    "Theta reduces option value every single minute.",
                    "Time decay accelerates rapidly in the last 2 days of weekly expiry.",
                    "Option buyers lose money if NIFTY stays sideways."
                ]
            },
            {
                "id": "greeks-vega",
                "title": "3.3 Vega & Implied Volatility (IV Crushes)",
                "summary": "Why VIX spikes inflate option prices and why IV crush happens right after major events.",
                "readTime": "5 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "Vega measures sensitivity to Implied Volatility (IV). When uncertainty or panic rises (India VIX spikes), demand for options increases, inflating option premiums."
                    },
                    {
                        "type": "h4",
                        "text": "Understanding IV Crush"
                    },
                    {
                        "type": "p",
                        "text": "Before major events (Union Budget, Election Results, RBI Policy), IV spikes to high levels. Immediately after the announcement, uncertainty resolves, IV collapses, and option premiums crash by 50%+ in minutes—even if you picked the right direction!"
                    },
                    {
                        "type": "callout",
                        "style": "takeaway",
                        "title": "Rule for Major Events",
                        "text": "Never buy naked options right before Union Budget or Election results. High IV makes premiums artificially inflated."
                    }
                ],
                "takeaway": [
                    "Vega measures volatility sensitivity.",
                    "India VIX spikes inflate option premiums for both CE and PE.",
                    "IV Collapse (Crush) destroys option value post-event."
                ]
            },
            {
                "id": "greeks-gamma",
                "title": "3.4 Gamma: Hero-to-Zero Expiry Moves",
                "summary": "How Gamma measures Delta change and powers explosive Hero-or-Zero moves on Expiry Day.",
                "readTime": "4 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "Gamma measures the rate of change of Delta. High Gamma means Delta can rapidly jump from 0.10 to 0.80 on a sudden price breakout."
                    },
                    {
                        "type": "h4",
                        "text": "Expiry Day Hero-or-Zero Dynamics"
                    },
                    {
                        "type": "p",
                        "text": "On Thursday afternoon (2:00 PM - 3:15 PM), Near-ATM options have extremely high Gamma. A fast 30-point NIFTY move can transform a ₹10 option into ₹70 in minutes."
                    },
                    {
                        "type": "callout",
                        "style": "warning",
                        "title": "Double-Edged Sword",
                        "text": "High Gamma cuts both ways. If the move fails, a ₹70 option can collapse to ₹0 just as quickly."
                    }
                ],
                "takeaway": [
                    "Gamma measures how fast Delta changes.",
                    "Gamma is highest for ATM options near expiry.",
                    "Drives explosive premium moves on Thursday afternoons."
                ]
            }
        ]
    },
    {
        "id": "module-4",
        "number": 4,
        "title": "Practical Option Trading Strategies",
        "description": "Learn Directional Buying, Bull Call Spreads, Bear Put Spreads, and Risk-Defined Hedging.",
        "icon": "ShieldCheck",
        "topics": [
            {
                "id": "directional-buying",
                "title": "4.1 Intraday Directional Buying (Single Leg)",
                "summary": "When and how to buy naked Call or Put options using strict Stop Loss rules.",
                "readTime": "5 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "Naked option buying involves purchasing a single Call or Put option to capitalize on fast, high-momentum intraday moves."
                    },
                    {
                        "type": "h4",
                        "text": "Ideal Entry Conditions"
                    },
                    {
                        "type": "ul",
                        "items": [
                            "Pre-Market Bias Score is strong (>= +0.30 for Calls, <= -0.30 for Puts).",
                            "Price breaks key day high / low with volume confirmation.",
                            "India VIX is steady (not in severe contraction)."
                        ]
                    },
                    {
                        "type": "callout",
                        "style": "tip",
                        "title": "Execution Rule",
                        "text": "Always set a hard Stop Loss at entry (15% - 25% of premium value). Cut losses quickly if price consolidates sideways."
                    }
                ],
                "takeaway": [
                    "Single leg buying requires strong directional momentum.",
                    "Must set Stop Loss immediately upon entry.",
                    "Avoid buying in tight sideways ranges."
                ]
            },
            {
                "id": "bull-call-spread",
                "title": "4.2 Bull Call Spread (Defined Risk)",
                "summary": "Buy ITM Call + Sell OTM Call to reduce cost and neutralize Theta decay.",
                "readTime": "6 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "A Bull Call Spread is a vertical spread created by buying a lower strike Call and selling a higher strike Call with the same expiry date."
                    },
                    {
                        "type": "h4",
                        "text": "Structure Example"
                    },
                    {
                        "type": "ul",
                        "items": [
                            "Buy NIFTY 24,100 CE @ ₹120",
                            "Sell NIFTY 24,300 CE @ ₹40",
                            "Net Outlay (Max Risk) = ₹120 - ₹40 = ₹80 (₹5,200 for 1 lot)",
                            "Max Profit = (Spread Width - Net Outlay) = 200 - 80 = ₹120 (₹7,800 for 1 lot)"
                        ]
                    },
                    {
                        "type": "callout",
                        "style": "takeaway",
                        "title": "Why Spreads Work",
                        "text": "Selling the higher strike Call collects premium, reducing your cost and shielding your trade against Theta time decay."
                    }
                ],
                "takeaway": [
                    "Caps maximum loss to net premium paid.",
                    "Reduces negative Theta time decay impact.",
                    "Ideal for moderate bullish trends."
                ]
            },
            {
                "id": "bear-put-spread",
                "title": "4.3 Bear Put Spread (Defined Risk)",
                "summary": "Buy ITM Put + Sell OTM Put for controlled bearish position taking.",
                "readTime": "5 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "A Bear Put Spread is a vertical spread created by buying a higher strike Put and selling a lower strike Put with the same expiry date."
                    },
                    {
                        "type": "h4",
                        "text": "Structure Example"
                    },
                    {
                        "type": "ul",
                        "items": [
                            "Buy NIFTY 24,200 PE @ ₹110",
                            "Sell NIFTY 24,000 PE @ ₹35",
                            "Net Cost = ₹75 per qty",
                            "Max Loss = ₹75 | Max Profit = 200 - 75 = ₹125"
                        ]
                    },
                    {
                        "type": "callout",
                        "style": "tip",
                        "title": "Best Use Case",
                        "text": "Use Bear Put Spreads when Tradeflow Pre-Market scan scores Bearish (-0.15 to -0.35) and global cues show weakness."
                    }
                ],
                "takeaway": [
                    "Risk-defined bearish trade strategy.",
                    "Protects against sharp IV contractions.",
                    "Lower capital requirement than naked options."
                ]
            }
        ]
    },
    {
        "id": "module-5",
        "number": 5,
        "title": "Risk Management & Trading Psychology",
        "description": "Master position sizing, hard stop losses, Risk-to-Reward ratios, and preventing revenge trading penalties.",
        "icon": "Zap",
        "topics": [
            {
                "id": "position-sizing-rule",
                "title": "5.1 The 2% Capital Rule & Position Sizing",
                "summary": "Never risk more than 1-2% of total trading account equity on a single paper trade.",
                "readTime": "5 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "Position sizing is the single most critical factor determining long-term survival in option trading. Never allocate your entire account balance into 1-2 trades."
                    },
                    {
                        "type": "h4",
                        "text": "The 2% Rule Calculation"
                    },
                    {
                        "type": "ul",
                        "items": [
                            "Total Trading Capital = ₹1,00,000",
                            "Maximum Risk per Trade (2%) = ₹2,000",
                            "If your Stop Loss on NIFTY option is ₹20 per unit (₹1,300 per lot of 65):",
                            "Maximum allowable lots = ₹2,000 / ₹1,300 = 1 Lot."
                        ]
                    },
                    {
                        "type": "callout",
                        "style": "warning",
                        "title": "Over-Leveraging Hazard",
                        "text": "Trading 10 lots on a ₹50,000 account means a 20% option drop wipes out 30% of your account in minutes. Always calculate lot size based on risk, not greed."
                    }
                ],
                "takeaway": [
                    "Limit risk to 1-2% of capital per trade.",
                    "Determine lot size AFTER calculating stop loss in Rupees.",
                    "Surviving bad streaks is key to consistency."
                ]
            },
            {
                "id": "risk-reward-ratio",
                "title": "5.2 Risk-to-Reward Ratios (Minimum 1:1.5)",
                "summary": "Why a high Risk-to-Reward ratio allows you to be profitable even with a 45% win rate.",
                "readTime": "5 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "Risk-to-Reward Ratio (R:R) compares the potential loss against the potential gain of a trade."
                    },
                    {
                        "type": "h4",
                        "text": "The Math of R:R"
                    },
                    {
                        "type": "p",
                        "text": "If you risk ₹1,000 to make ₹2,000 (1:2 R:R), you only need to win 34% of your trades to break even! At a 50% win rate over 100 trades, a 1:2 R:R yields substantial net profitability."
                    },
                    {
                        "type": "callout",
                        "style": "takeaway",
                        "title": "Tradeflow System Requirement",
                        "text": "Tradeflow ticket calculates R:R automatically. Avoid taking trades where R:R is below 1:1.0."
                    }
                ],
                "takeaway": [
                    "Target minimum 1:1.5 or 1:2 Risk-to-Reward ratio.",
                    "High R:R compensates for inevitable losing trades.",
                    "Never risk ₹30 to make ₹10."
                ]
            },
            {
                "id": "preventing-revenge-trading",
                "title": "5.3 Overcoming Revenge Trading & Discipline",
                "summary": "Why Tradeflow penalizes rapid revenge trades and how to reset your emotional state after a loss.",
                "readTime": "4 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "Revenge trading happens when a trader suffers a loss and immediately opens a new high-risk trade to 'get their money back' from the market."
                    },
                    {
                        "type": "h4",
                        "text": "The Psychology Loop"
                    },
                    {
                        "type": "p",
                        "text": "Revenge trades are driven by anger, frustration, and wounded ego—not market edge. 90% of account blowouts happen during revenge trading sprees following a normal loss."
                    },
                    {
                        "type": "callout",
                        "style": "warning",
                        "title": "Tradeflow XP Penalty",
                        "text": "Tradeflow detects new trades opened within 5 minutes of closing a loss and slaps a -25 XP penalty. Take a mandatory 15-minute breather after every stop loss."
                    }
                ],
                "takeaway": [
                    "Losses are a normal cost of doing business in trading.",
                    "Revenge trading is the #1 cause of retail account blowouts.",
                    "Step away from the screen for 15 minutes after a loss."
                ]
            }
        ]
    },
    {
        "id": "module-6",
        "number": 6,
        "title": "Quantitative Scanning & Tradeflow Methodology",
        "description": "How the Tradeflow Pre-Market scan evaluates global macro weights, alignment, and playbooks.",
        "icon": "Cpu",
        "topics": [
            {
                "id": "tradeflow-quant-model",
                "title": "6.1 Understanding the Macro Bias Score",
                "summary": "How weighted contributions from GIFT Nifty, DXY, VIX, Crude, and Nasdaq produce the final score.",
                "readTime": "5 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "The Tradeflow Engine runs a quantitative multi-asset model every morning at 8:00 AM IST to compute the directional bias for NIFTY 50."
                    },
                    {
                        "type": "h4",
                        "text": "Weight Breakdown"
                    },
                    {
                        "type": "ul",
                        "items": [
                            "GIFT Nifty (+0.40): Primary lead indicator.",
                            "DXY Dollar Index (-0.15): Currency/FII flow pressure.",
                            "NASDAQ (+0.10): Global tech sentiment.",
                            "Crude Oil (-0.10): Domestic inflation/margins.",
                            "US VIX (-0.10): Global risk appetite.",
                            "S&P 500 (+0.05), Nikkei (+0.05), US 10Y (-0.05)."
                        ]
                    },
                    {
                        "type": "callout",
                        "style": "tip",
                        "title": "Score Reading",
                        "text": "+0.30 or higher: Strong Bullish | +0.10 to +0.29: Bullish\n-0.10 to -0.29: Bearish | -0.30 or lower: Strong Bearish"
                    }
                ],
                "takeaway": [
                    "Quant score synthesizes 8 overnight global assets into a single bias.",
                    "Negative weights account for inverse correlations (DXY, Crude, VIX).",
                    "Establishes daily market context before 9:15 AM open."
                ]
            },
            {
                "id": "tradeflow-xp-system",
                "title": "6.2 The Process-First XP Reward System",
                "summary": "Why Tradeflow rewards disciplined trading habits (SL, Thesis, Reports) instead of P&L results.",
                "readTime": "4 min read",
                "content": [
                    {
                        "type": "p",
                        "text": "Most trading apps reward raw P&L gains, encouraging reckless gambling. Tradeflow flips this model by rewarding professional trading execution."
                    },
                    {
                        "type": "h4",
                        "text": "XP Reward Breakdown"
                    },
                    {
                        "type": "ul",
                        "items": [
                            "+10 XP: Logging a paper trade.",
                            "+20 XP: Setting a mandatory Stop Loss.",
                            "+15 XP: Writing a pre-trade Thesis in the ticket.",
                            "+10 XP: Reading the AI mentor report post-trade.",
                            "-25 XP: Penalty for revenge trading within 5 minutes.",
                            "0 XP: P&L outcome (Profit/Loss produces 0 XP in all cases)."
                        ]
                    },
                    {
                        "type": "callout",
                        "style": "takeaway",
                        "title": "Core Philosophy",
                        "text": "Focus on flawless execution of your trading process. P&L is simply a byproduct of disciplined risk management."
                    }
                ],
                "takeaway": [
                    "Tradeflow rewards disciplined process, not lucky profits.",
                    "Mandatory Stop Loss + Thesis = Maximum XP earned.",
                    "Builds real institutional trading habits."
                ]
            }
        ]
    }
]


def generate_js_content():
    """Generates clean ES module export for frontend/src/lib/learnData.js"""
    js_content = "// Generated by scripts/scrape_learn_content.py\n"
    js_content += "export const learnModules = " + json.dumps(MODULES, indent=2) + ";\n\n"
    
    # Flatten topics for legacy or direct ID lookups
    all_topics = []
    for mod in MODULES:
        for topic in mod["topics"]:
            all_topics.append({
                **topic,
                "moduleId": mod["id"],
                "moduleTitle": mod["title"],
                "moduleNumber": mod["number"]
            })
            
    js_content += "export const learnTopics = " + json.dumps(all_topics, indent=2) + ";\n\n"
    js_content += "// Backward compatibility export\n"
    js_content += "export const learnContent = learnTopics;\n"
    
    target_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "lib", "learnData.js")
    )
    
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    with open(target_path, "w", encoding="utf-8") as f:
        f.write(js_content)
        
    print(f"[Learn Scraper] Successfully generated {len(MODULES)} modules with {len(all_topics)} topics at {target_path}")

if __name__ == "__main__":
    generate_js_content()
