export default function Home() {
  return (
    <div className="text-center py-16">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Find the Sniper
      </h1>
      <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
        Test your observation skills by finding hidden snipers in challenging images. 
        Can you spot them all?
      </p>
      <div className="space-y-4">
        <a
          href="/play/1"
          className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Start Playing
        </a>
        <div className="text-sm text-gray-500">
          New challenges added daily
        </div>
      </div>
    </div>
  );
}
