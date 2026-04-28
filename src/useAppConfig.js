import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export function useAppConfig() {
    const [config, setConfig] = useState({})

    useEffect(() => {
        // Fetch all text variables initially
        const fetchConfig = async () => {
            const { data } = await supabase.from('app_config').select('*')
            if (data) {
                const configObj = {}
                data.forEach(item => configObj[item.config_key] = item.config_value)
                setConfig(configObj)
            }
        }
        fetchConfig()

        // Listen for live changes from the Admin Panel
        const sub = supabase.channel('app-config-changes')
            .on('postgres', { event: 'UPDATE', schema: 'public', table: 'app_config' }, payload => {
                setConfig(prev => ({ ...prev, [payload.new.config_key]: payload.new.config_value }))
            }).subscribe()

        return () => supabase.removeChannel(sub)
    }, [])

    return config
}