<div id="welcome-screen">
  <h2>CSII Team X presents</h2>
  <p>Thai Consonants</p>
  
  <input type="text" id="nickname-input" placeholder="Enter your nickname" style="margin-bottom: 10px; padding: 5px;">
  <br>
  <button id="start-btn" onclick="startQuiz()">Start Quiz</button>
</div>

<div id="quiz-screen" style="display:none;">
  <h3 id="user-display"></h3> <div id="hearts">❤️❤️❤️</div>
  <p>Remaining: <span id="remaining-count">35</span></p>
  </div>

<script>
async function startQuiz() {
    const nickname = document.getElementById('nickname-input').value.trim();
    if (!nickname) {
        alert("Please enter a nickname first!");
        return;
    }

    try {
        // Call the backend to increment/get the streak counter
        const response = await fetch(`https://YOURSITE-service.onrender.com/start-quiz/${nickname}`, {
            method: 'POST'
        });
        const data = await response.json();
        
        // Show nickname and streak (e.g., "marko: 5")
        document.getElementById('user-display').innerText = `${nickname}: ${data.count}`;
        
        // Switch screens
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('quiz-screen').style.display = 'block';
        
        // Initialize your drill logic here...
    } catch (error) {
        console.error("Backend unreachable:", error);
        // Fallback if backend is down
        document.getElementById('user-display').innerText = nickname;
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('quiz-screen').style.display = 'block';
    }
}
</script>
