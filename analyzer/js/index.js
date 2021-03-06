/**
 *Created by Alexandr Vezhlev.
 */

/**
 *Localization data
 */
const COLUMN_NUMBER = "#";
const COLUMN_TOTAL_DURATION = "Total duration";
const COLUMN_NAMES = {
					callingPartyNumber: "Calling party number",
					originalCalledPartyNumber: "Called party number (orig.)",
					finalCalledPartyNumber: "Called party number (final)",
					dateTimeOrigination: "Origination time",
					dateTimeConnect: "Connect time",
					dateTimeDisconnect: "Disconnect time",
					duration: "Duration"
					};

/**
 *Can do some tweaks here
 */
var requestTimeout = 3000; //timeout of AJAX request in milliseconds
var renderStep = 200; //number of rows to add to a table as a single batch

/**
 *Global counters
 */
var dataColumnCount;
var totalDuration ;
 
 /**
 *Sets the default values of date-time input fields.
 *Begin date field is set to the day-before-yesterday midnight.
 *End date is set to current time with seconds reset to zero.
 */
function setDefaultDateTime() {

	var currentDate,
	twoDaysAgo,
	currentDateString,
	twoDaysAgoString;

	currentDate = new Date();
	twoDaysAgo = new Date(currentDate.getTime() - 1000 * 60 * 60 * 24 * 2);

	//some dirty, dirty tricks here,
	//reset the seconds to zero, shift the time forward by timezone offset
	currentDate.setHours(currentDate.getHours() - currentDate.getTimezoneOffset() / 60, currentDate.getMinutes(), 0);
	//so that after converting the time into UTC time string we get our local time string
	currentDateString = currentDate.toISOString();
	//remove last 5 characters which are ".mscZ"
	currentDateString = currentDateString.substr(0, currentDateString.length - 5);
	
	//same here,
	//timezone shift trick while setting time to midnight
	twoDaysAgo.setHours(-twoDaysAgo.getTimezoneOffset() / 60, 0, 0);
	twoDaysAgoString = twoDaysAgo.toISOString();
	twoDaysAgoString = twoDaysAgoString.substr(0, twoDaysAgoString.length - 5);
	
	//set default date-time values to respective fields
	document.getElementById("begintime").defaultValue = twoDaysAgoString;
	document.getElementById("endtime").defaultValue = currentDateString;
}

/**
 *Sends AJAX request to the server-side script and updates interface after receiving an answer.
 */
function queryData() {
	
	document.getElementById("content").innerHTML = "";
	document.getElementById("spinner").className = "spinner";
	
	var request = new XMLHttpRequest();
	request.onreadystatechange = function() {
		
		if (request.readyState == 4) {
		
			if (request.status == 200) {
			
				showData(request.responseText);
			} else {

				showData('[{"Error: ":"Server is not responding"}]');
			}

			document.getElementById("spinner").className = "spinner hidden";
		}
	};
	
	request.ontimeout = function() {

		document.getElementById("spinner").className = "spinner hidden";
		alert("Request timed out");
	};
	
	var timezoneOffset = (new Date).getTimezoneOffset() * 60;
	
	var beginTime = Date.parse(document.getElementById("begintime").value);
	if (isNaN(beginTime)) {
		beginTime = 0;
	} else {
		beginTime = Math.floor(beginTime / 1000) + timezoneOffset;
	}
	
	var endTime = Date.parse(document.getElementById("endtime").value);
	if (isNaN(endTime)) {
		endTime = 2147483647;
	} else {
		endTime = Math.floor(endTime / 1000) + timezoneOffset;
	}

	var body = "direction=" + encodeURIComponent(document.getElementById("direction").value) +
				"&number=" + encodeURIComponent(document.getElementById("number").value) + 
				"&begintime=" + encodeURIComponent(beginTime) + 
				"&endtime=" + encodeURIComponent(endTime) + 
				"&zero=" + encodeURIComponent(document.getElementById("zero").checked);
	
	request.open("POST", window.location.pathname + "/api/calls/", true);
	request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');						
	request.timeout = requestTimeout;
	request.send(body);
}

/**
 *Parses JSON array of objects and outputs it as an HTML table into the Content div
 */
function showData(data) {
	
	if (data) {
	
		var calls = JSON.parse(data);
		
		if (calls != null && calls.length > 0) {

            var table = document.createElement("TABLE");
            var thead = document.createElement("THEAD");
            table.appendChild(thead);
		
			var row = thead.insertRow(-1);
			
			var headerCell = document.createElement("TH");
			headerCell.innerHTML = COLUMN_NUMBER;
			row.appendChild(headerCell);
			
			dataColumnCount = 0;
			
			for (key in calls[0]) {
				
				var headerCell = document.createElement("TH");
				headerCell.innerHTML = key in COLUMN_NAMES ? COLUMN_NAMES[key] : key;
				row.appendChild(headerCell);
				++dataColumnCount;
			}

            var tbody = document.createElement("TBODY");
            table.appendChild(tbody);

            document.getElementById("content").appendChild(table);

            totalDuration = 0;

            var iterations = parseInt(calls.length / renderStep) + 1;
            for (var i = 0; i < iterations; ++i) {

                setTimeout(createRow, 0, calls, i * renderStep, tbody);
            }
		}
		
	} else {
	
		alert("Invalid input parameters");
	}
}


/**
 *Creates 'renderStep' table rows out of 'calls' array starting from 'index' and appends them to tbody
 */
function createRow(calls, index, tbody) {
	
	var rows = new Array;

	var bound;
	if ((index + renderStep + 1) > calls.length) {

		bound = calls.length;
	} else {

		bound = index + renderStep;
	}

	for (var i = index; i < bound; ++i) {

		var row = document.createElement("TR");
		row.insertCell(-1).innerHTML = i + 1;

		for (key in calls[i]) {
			
			var cell = row.insertCell(-1);
			
			switch (true) {
				
				//convert unix time data to a readable local time
				case key.toLowerCase().includes("datetime"):
				cell.innerHTML = formatDateTime(calls[i][key]);
				break;
				
				//convert duration data to h:mm:ss format
				case key.toLowerCase().includes("duration"):
					
					cell.innerHTML = getDurationString(calls[i][key]);
					
					if (key === "duration") {
						totalDuration += parseInt(calls[i][key]);
					}
					break;
					
				//print other data as is
				default:
					cell.innerHTML = calls[i][key];
			}
		}

		rows.push(row);
	}

	for (var i = 0; i < rows.length; ++i) {

		tbody.appendChild(rows[i]);
	}

	//if the row is the last one
	if ((index + renderStep + 1) > calls.length && calls.length > 1) {
		//add row with total duration data
		var row = tbody.insertRow(-1);
		var cell = row.insertCell(-1);
		cell.colSpan = dataColumnCount;
		cell.innerHTML = COLUMN_TOTAL_DURATION;
		row.insertCell(-1).innerHTML = getDurationString(totalDuration);
		
	}
}


/**
 *Converts duration in seconds to h:mm:ss format
 */
function getDurationString(duration) {

	var h = Math.floor(duration / 3600);
	var m = Math.floor((duration - h *3600) / 60);
	var s = duration - h *3600 - m * 60;

	return (h > 0 ? h + ":" : "") + pad(m) + ":" + pad(s);

}


/**
 *Pads number less than 10 with leading zero
 */
function pad(num) {
	
	return num < 10 ? "0" + num : num;
}


/**
 *Converts UTC Unix-time into a local date-time string
 */
function formatDateTime(unixTime) {

	if (unixTime == 0) {
		return "";
	}
	
	var timezoneOffset = (new Date).getTimezoneOffset() * 60;
	
	var asString = new Date((unixTime - timezoneOffset) * 1000).toISOString();
	return asString.substr(0, asString.length - 5).replace("T", " ");
}