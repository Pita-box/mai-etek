export default function LockScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8 text-center space-y-6 border border-gray-700">
        <div className="w-20 h-20 mx-auto bg-gray-700 rounded-full flex items-center justify-center">
          <svg
            className="w-10 h-10 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-white">
          Čeká se na schválení účtu
        </h2>

        <p className="text-gray-400">
          Tvůj účet byl úspěšně vytvořen, ale momentálně jsi v ne přiřazeném
          stavu.
        </p>

        <div className="pt-4 border-t border-gray-700">
          <p className="text-sm text-gray-500">
            Měj strpení a počkej, až si tě tvůj Dom přivlastní. Jakmile si
            nárokuje tvůj profil, tvoje funkce se ti automaticky odemknou.
          </p>
        </div>

        {/* Simple visual indicator that it's polling/waiting */}
        <div className="flex justify-center space-x-2 pt-4">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
          <div
            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
            style={{ animationDelay: "0.2s" }}></div>
          <div
            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
            style={{ animationDelay: "0.4s" }}></div>
        </div>
      </div>
    </div>
  )
}
