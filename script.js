document.addEventListener('DOMContentLoaded', () => {
    // const API_BASE_URL = 'http://127.0.0.1:8000/api'; // Your FastAPI backend URL
    const API_BASE_URL = 'https://winning-gently-elf.ngrok-free.app/api'; //  Your FastAPI backend URL

    const accountBalanceEl = document.getElementById('accountBalance');
    const riskSlider = document.getElementById('riskSlider');
    const riskDisplay = document.getElementById('riskDisplay');
    const sliderFill = document.getElementById('sliderFill');
    const instrumentEl = document.getElementById('instrument');
    const entryPriceEl = document.getElementById('entryPrice');
    const slPriceEl = document.getElementById('slPrice');
    const instrumentInfoEl = document.getElementById('instrumentInfo');
    const currentPriceDisplay = document.getElementById('currentPriceDisplay');
    
    const fetchBalanceBtn = document.getElementById('fetchBalanceBtn');
    const fetchMarketPriceBtn = document.getElementById('fetchMarketPriceBtn');
    const calculateBtn = document.getElementById('calculateBtn');
    const buyBtn = document.getElementById('buyBtn');
    const sellBtn = document.getElementById('sellBtn');
    
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

    let instrumentsConfig = {};
    let currentDirection = 'BUY';

    // Risk slider functionality
    riskSlider.addEventListener('input', function() {
        const value = this.value;
        riskDisplay.textContent = value + '%';
        sliderFill.style.width = (value / 10 * 100) + '%';
    });

    // Trade direction buttons
    buyBtn.addEventListener('click', () => setDirection('BUY'));
    sellBtn.addEventListener('click', () => setDirection('SELL'));

    function setDirection(direction) {
        currentDirection = direction;
        buyBtn.classList.toggle('active', direction === 'BUY');
        sellBtn.classList.toggle('active', direction === 'SELL');
    }

    function displayError(message) {
        errorDisplayEl.textContent = message;
        errorDisplayEl.style.display = 'block';
        resultsEl.classList.remove('show');
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
            const existingHeaders = options.headers || {};
            const newHeaders = {
                ...existingHeaders,
                'ngrok-skip-browser-warning': 'any_value_is_fine'
            };

            const fetchOptions = {
                ...options,
                headers: newHeaders
            };

            const response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: `HTTP error! Status: ${response.status}` }));
                throw new Error(errorData.detail || `HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Fetch error:', error);
            displayError(error.message || 'Failed to fetch from API.');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    async function loadInstruments() {
        try {
            const data = await fetchApi('/instruments');
            instrumentsConfig = data;
            instrumentEl.innerHTML = '<option value="">Select Instrument</option>';
            for (const key in instrumentsConfig) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = instrumentsConfig[key].description;
                instrumentEl.appendChild(option);
            }
            updateInstrumentInfo();
            updatePriceInputSteps();
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
            const balance = data.balance.toFixed(2);
            accountBalanceEl.textContent = `$${balance}`;
        } catch (error) { /* Error already displayed by fetchApi */ }
    });

    fetchMarketPriceBtn.addEventListener('click', async () => {
        const selectedKey = instrumentEl.value;
        if (!selectedKey || !instrumentsConfig[selectedKey]) {
            displayError("Please select a valid instrument first.");
            return;
        }
        const apiSymbol = instrumentsConfig[selectedKey].api_symbol;
        try {
            const data = await fetchApi(`/price/${apiSymbol}`);
            const priceToUse = currentDirection === 'BUY' ? 
                (data.ask !== null ? data.ask : data.spot) : 
                (data.bid !== null ? data.bid : data.spot);
                
            if (priceToUse !== null) {
                const formattedPrice = priceToUse.toFixed(instrumentsConfig[selectedKey].price_decimals);
                entryPriceEl.value = formattedPrice;
                currentPriceDisplay.textContent = formattedPrice;
                suggestStopLoss(priceToUse, currentDirection, selectedKey);
            } else {
                displayError(`Price not available for ${instrumentsConfig[selectedKey].description}.`);
            }
        } catch (error) { /* Error already handled */ }
    });

    calculateBtn.addEventListener('click', async () => {
        clearError();
        resultsEl.classList.remove('show');

        // Extract balance number from display text
        const balanceText = accountBalanceEl.textContent.replace('$', '').replace(',', '');
        const balance = parseFloat(balanceText);

        const payload = {
            account_balance: balance,
            risk_percentage: parseFloat(riskSlider.value),
            instrument_key: instrumentEl.value,
            entry_price: parseFloat(entryPriceEl.value),
            sl_price: parseFloat(slPriceEl.value),
            direction: currentDirection
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

            resultsEl.classList.add('show');
            resultLotSizeEl.textContent = data.final_lot_size_formatted;
            resultRiskAmountEl.textContent = `$${data.risk_amount_currency.toFixed(2)}`;
            resultMoneyAtRiskPerLotEl.textContent = `$${data.money_at_risk_per_lot.toFixed(2)}`;
            resultSLDistanceEl.textContent = `${data.sl_distance_price_units.toFixed(instrumentsConfig[payload.instrument_key].price_decimals)} (${data.sl_distance_ticks.toFixed(0)} ticks)`;
            resultRawLotEl.textContent = data.raw_lot_size.toFixed(8);
            resultMessageEl.textContent = data.message || '';
            resultMinLotInfoEl.textContent = data.actual_risk_if_min_lot_info || '';
            resultMinLotInfoEl.style.display = data.actual_risk_if_min_lot_info ? 'block' : 'none';

        } catch (error) { /* Error already displayed by fetchApi */ }
    });

    function suggestStopLoss(entryPrice, direction, instrumentKey) {
        const config = instrumentsConfig[instrumentKey];
        const defaultPips = 20;
        const pipValue = config.tick_size * 10;
        const slDistance = defaultPips * pipValue;
        
        const suggestedSL = direction === 'BUY' ? 
            entryPrice - slDistance : 
            entryPrice + slDistance;
            
        slPriceEl.value = suggestedSL.toFixed(config.price_decimals);
    }

    function validateStopLoss() {
        const entry = parseFloat(entryPriceEl.value);
        const sl = parseFloat(slPriceEl.value);
        
        if (isNaN(entry) || isNaN(sl)) return true;
        
        if (currentDirection === 'BUY' && sl >= entry) {
            displayError("For BUY orders, Stop Loss must be below Entry Price");
            return false;
        }
        if (currentDirection === 'SELL' && sl <= entry) {
            displayError("For SELL orders, Stop Loss must be above Entry Price");
            return false;
        }
        return true;
    }

    // Add direction change handler to validate SL
    buyBtn.addEventListener('click', () => {
        if (entryPriceEl.value && slPriceEl.value) {
            validateStopLoss();
        }
    });

    sellBtn.addEventListener('click', () => {
        if (entryPriceEl.value && slPriceEl.value) {
            validateStopLoss();
        }
    });

    // Initial load
    loadInstruments();
});