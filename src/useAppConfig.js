import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export function useAppConfig() {
    const [config, setConfig] = useState({})

    useEffect(() => {
        const fetchConfig = async () => {
            const { data } = await supabase.from('app_config').select('*')
            if (data) {
                const configObj = {}
                data.forEach(item => {
                    configObj[item.config_key] = item.config_value
                    // Also store the visibility flag (defaults to true if null)
                    configObj[`${item.config_key}_visible`] = item.is_visible !== false
                })
                setConfig(configObj)
            }
        }
        fetchConfig()

        const sub = supabase.channel('app-config-changes')
            .on('postgres', { event: '*', schema: 'public', table: 'app_config' }, payload => {
                if (payload.new) {
                    setConfig(prev => ({ 
                        ...prev, 
                        [payload.new.config_key]: payload.new.config_value,
                        [`${payload.new.config_key}_visible`]: payload.new.is_visible !== false
                    }))
                }
            }).subscribe()

        return () => supabase.removeChannel(sub)
    }, [])

    return config
}