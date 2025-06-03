document.addEventListener('DOMContentLoaded', () => {
    // const API_BASE_URL = 'http://127.0.0.1:8000/api'; // Your FastAPI backend URL
    const API_BASE_URL = 'https://winning-gently-elf.ngrok-free.app/api'; // Your FastAPI backend URL

    const accountBalanceEl = document.getElementById('accountBalance');
    const riskPercentageEl = document.getElementById('riskPercentage');
    const instrumentEl = document.getElementById('instrument');
    const entryPriceEl = document.getElementById('entryPrice');
    const slPriceEl = document.getElementById('slPrice');
    const instrumentInfoEl = document.getElementById('instrumentInfo');

    const fetchBalanceBtn = document.getElementById('fetchBalanceBtn');
    const fetchAskPriceBtn = document.getElementById('fetchAskPriceBtn');
    const fetchBidPriceBtn = document.getElementById('fetchBidPriceBtn');
    const calculateBtn = document.getElementById('calculateBtn');

    const resultsEl = document.getElementById('results');
    const resultLotSizeEl = document.getElementById('resultLotSize');
    const resultRiskAmountEl = document.getElementById('resultRiskAmount');
    const resultMoneyAtRiskPerLotEl = document.getElementById('resultMoneyAtRiskPerLot');
    const resultSLDistanceEl = document.getElementById('resultSLDistance');
    const resultRawLotEl = document.getElementById('resultRawLot');
    const resultMessageEl = document.getElementById('resultMessage');
    const resultMinLotInfoEl = document.getElementById('resultMinLotInfo');
    const errorDisplayEl = document.getElementById('errorDisplay');
    const loadingIndicatorEl = document.getElementById('loadingIndicator');

    let instrumentsConfig = {}; // To store instrument data from backend

    function displayError(message) {
        errorDisplayEl.textContent = message;
        errorDisplayEl.style.display = 'block';
        resultsEl.style.display = 'none';
    }

    function clearError() {
        errorDisplayEl.textContent = '';
        errorDisplayEl.style.display = 'none';
    }
    
    function showLoading(show) {
        loadingIndicatorEl.style.display = show ? 'block' : 'none';
    }

    async function fetchApi(endpoint, options = {}) {
        showLoading(true);
        clearError();
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: `HTTP error! Status: ${response.status}` }));
                throw new Error(errorData.detail || `HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Fetch error:', error);
            displayError(error.message || 'Failed to fetch from API.');
            throw error; // Re-throw to stop further processing if needed
        } finally {
            showLoading(false);
        }
    }


    async function loadInstruments() {
        try {
            const data = await fetchApi('/instruments');
            instrumentsConfig = data;
            instrumentEl.innerHTML = ''; // Clear existing options
            for (const key in instrumentsConfig) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = instrumentsConfig[key].description;
                instrumentEl.appendChild(option);
            }
            updateInstrumentInfo(); // Initial info display
            updatePriceInputSteps(); // Update step for default instrument
        } catch (error) {
            displayError('Could not load instruments config.');
        }
    }
    
    function updatePriceInputSteps() {
        const selectedKey = instrumentEl.value;
        if (instrumentsConfig[selectedKey]) {
            const decimals = instrumentsConfig[selectedKey].price_decimals;
            const stepValue = Math.pow(10, -decimals).toFixed(decimals);
            entryPriceEl.step = stepValue;
            slPriceEl.step = stepValue;
            // Potentially update placeholder or default values if needed
        }
    }

    function updateInstrumentInfo() {
        const selectedKey = instrumentEl.value;
        if (instrumentsConfig[selectedKey]) {
            const config = instrumentsConfig[selectedKey];
            instrumentInfoEl.innerHTML = `
                API Symbol: ${config.api_symbol}<br>
                Tick Size: ${config.tick_size}, Tick Value: $${config.tick_value.toFixed(4)}<br>
                Min Lot: ${config.min_lot}, Lot Step: ${config.lot_step}
            `;
            updatePriceInputSteps();
        } else {
            instrumentInfoEl.innerHTML = '';
        }
    }

    instrumentEl.addEventListener('change', updateInstrumentInfo);

    fetchBalanceBtn.addEventListener('click', async () => {
        try {
            const data = await fetchApi('/balance');
            accountBalanceEl.value = data.balance.toFixed(2);
        } catch (error) { /* Error already displayed by fetchApi */ }
    });

    fetchAskPriceBtn.addEventListener('click', async () => {
        const selectedKey = instrumentEl.value;
        if (!selectedKey || !instrumentsConfig[selectedKey]) {
            displayError("Please select a valid instrument first.");
            return;
        }
        const apiSymbol = instrumentsConfig[selectedKey].api_symbol;
        try {
            const data = await fetchApi(`/price/${apiSymbol}`);
            const priceToUse = data.ask !== null ? data.ask : data.spot;
            if (priceToUse !== null) {
                entryPriceEl.value = priceToUse.toFixed(instrumentsConfig[selectedKey].price_decimals);
            } else {
                displayError(`Ask/Spot price not available for ${instrumentsConfig[selectedKey].description}.`);
            }
        } catch (error) { /* Error already displayed */ }
    });
    
    fetchBidPriceBtn.addEventListener('click', async () => {
        const selectedKey = instrumentEl.value;
         if (!selectedKey || !instrumentsConfig[selectedKey]) {
            displayError("Please select a valid instrument first.");
            return;
        }
        const apiSymbol = instrumentsConfig[selectedKey].api_symbol;
        try {
            const data = await fetchApi(`/price/${apiSymbol}`);
            const priceToUse = data.bid !== null ? data.bid : data.spot; // Use spot if bid is null
            if (priceToUse !== null) {
                // Suggest SL, don't auto-fill. Maybe put it in a placeholder or info field.
                // For simplicity, we'll just log it or put it in an info field if we had one.
                // slPriceEl.value = priceToUse.toFixed(instrumentsConfig[selectedKey].price_decimals);
                alert(`Suggested SL (current Bid/Spot for ${instrumentsConfig[selectedKey].description}): ${priceToUse.toFixed(instrumentsConfig[selectedKey].price_decimals)}`);
            } else {
                displayError(`Bid/Spot price not available for ${instrumentsConfig[selectedKey].description}.`);
            }
        } catch (error) { /* Error already displayed */ }
    });


    calculateBtn.addEventListener('click', async () => {
        clearError();
        resultsEl.style.display = 'none'; // Hide previous results

        const payload = {
            account_balance: parseFloat(accountBalanceEl.value),
            risk_percentage: parseFloat(riskPercentageEl.value),
            instrument_key: instrumentEl.value,
            entry_price: parseFloat(entryPriceEl.value),
            sl_price: parseFloat(slPriceEl.value)
        };

        if (isNaN(payload.account_balance) || isNaN(payload.risk_percentage) ||
            isNaN(payload.entry_price) || isNaN(payload.sl_price) || !payload.instrument_key) {
            displayError("Please fill in all fields with valid numbers.");
            return;
        }

        try {
            const data = await fetchApi('/calculate-lot-size', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            resultsEl.style.display = 'block';
            resultLotSizeEl.textContent = `Recommended Lot Size: ${data.final_lot_size_formatted}`;
            resultRiskAmountEl.textContent = `Risk Amount: $${data.risk_amount_currency.toFixed(2)}`;
            resultMoneyAtRiskPerLotEl.textContent = `Money at Risk per 1 Lot: $${data.money_at_risk_per_lot.toFixed(2)}`;
            resultSLDistanceEl.textContent = `SL Distance: ${data.sl_distance_price_units.toFixed(instrumentsConfig[payload.instrument_key].price_decimals)} (price units), ${data.sl_distance_ticks.toFixed(0)} (ticks)`;
            resultRawLotEl.textContent = `Raw Calculated Lot: ${data.raw_lot_size.toFixed(8)}`;
            resultMessageEl.textContent = data.message || '';
            resultMinLotInfoEl.textContent = data.actual_risk_if_min_lot_info || '';
            resultMinLotInfoEl.style.display = data.actual_risk_if_min_lot_info ? 'block' : 'none';

        } catch (error) { /* Error already displayed by fetchApi */ }
    });

    // Initial load
    loadInstruments();
});