import { useState } from 'react'

export default function MapDeployGift({ coords, isDeploying, onDeploy, onClose }) {
    const [gemType, setGemType] = useState('Quartz')
    const [gemQty, setGemQty] = useState(1)

    if (!coords) return null;

    const handleSubmit = (e) => {
        e.preventDefault()
        onDeploy({ gemType, gemQty, lat: coords.lat, lng: coords.lng })
    }

    return (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-red-900/10 border-2 border-red-500/50 w-full max-w-md rounded-[32px] overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.2)] p-6 relative">
                
                <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-white">✕</button>
                
                <h3 className="text-3xl font-['Bebas_Neue'] text-red-500 tracking-widest mb-2">Admin Override</h3>
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-6 border-b border-red-900/30 pb-4">
                    Deploy GeoGift to coordinates: <br/>
                    <span className="text-white">{coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</span>
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-pink-400 mb-1 block">Gem Type</label>
                            <select 
                                value={gemType} 
                                onChange={e => setGemType(e.target.value)} 
                                className="w-full bg-black border border-pink-900/50 p-4 rounded-xl text-white outline-none focus:border-pink-500"
                            >
                                <option value="Quartz">Quartz</option>
                                <option value="Amethyst">Amethyst</option>
                                <option value="Jade">Jade</option>
                                <option value="Emerald">Emerald</option>
                                <option value="Sapphire">Sapphire</option>
                                <option value="Ruby">Ruby</option>
                                <option value="Diamond">Diamond</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-pink-400 mb-1 block">Quantity</label>
                            <input 
                                type="number" 
                                min="1" 
                                value={gemQty} 
                                onChange={e => setGemQty(parseInt(e.target.value))} 
                                className="w-full bg-black border border-pink-900/50 p-4 rounded-xl text-white outline-none focus:border-pink-500" 
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isDeploying}
                        className="w-full mt-4 bg-red-600 hover:bg-red-500 disabled:bg-gray-800 disabled:text-gray-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors shadow-lg shadow-red-500/20"
                    >
                        {isDeploying ? 'Deploying...' : 'Deploy to Map'}
                    </button>
                </form>
            </div>
        </div>
    )
}