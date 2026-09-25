import { Chip, Paper, TextField } from "@material-ui/core";
import Autocomplete from "@mui/material/Autocomplete";
import React, { useEffect, useRef, useState } from "react";
import { isArray, isString } from "lodash";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

export function TagsContainer({ contact }) {

    const [tags, setTags] = useState([]);
    const [selecteds, setSelecteds] = useState([]);
    const isMounted = useRef(true);

    useEffect(() => {
        return () => {
            isMounted.current = false
        }
    }, [])

    useEffect(() => {
        if (isMounted.current) {
            loadTags();
        }
    }, []);

    useEffect(() => {
        if (isMounted.current && contact) {
            if (Array.isArray(contact.tags)) {
                setSelecteds(contact.tags);
            } else {
                setSelecteds([]);
            }
        }
    }, [contact]);

    const createTag = async (data) => {
        try {
            const { data: responseData } = await api.post(`/tags`, data);
            return responseData;
        } catch (err) {
            toastError(err);
        }
    }

    const loadTags = async () => {
        try {
            console.log('[TagsContainer] Carregando tags...');
            const { data } = await api.get(`/tags/list`, {
                params: { kanban: 0 }
            });
            console.log('[TagsContainer] Tags carregadas:', data);
            if (isMounted.current) {
                setTags(data || []);
                console.log('[TagsContainer] Tags definidas no estado:', (data || []).length);
            }
        } catch (err) {
            console.error('[TagsContainer] Erro ao carregar tags:', err);
            console.error('[TagsContainer] Erro completo:', err.response?.data || err.message);
            toastError(err);
            if (isMounted.current) {
                setTags([]);
            }
        }
    }

    const syncTags = async (data) => {
        try {
            const { data: responseData } = await api.post(`/tags/sync`, data);
            return responseData;
        } catch (err) {
            toastError(err);
        }
    }

    const onChange = async (event, value, reason) => {
        let optionsChanged = [];
        
        if (reason === 'createOption') {
            // Nova tag sendo criada
            const newValue = value[value.length - 1];
            if (isString(newValue)) {
                if (newValue.length < 3) {
                    toastError("Tag muito curta!");
                    return;
                }
                try {
                    const newTag = await createTag({ name: newValue, kanban: 0, color: getRandomHexColor() });
                    if (newTag) {
                        optionsChanged = [...value.slice(0, -1), newTag];
                        await loadTags();
                    }
                } catch (err) {
                    console.error('[TagsContainer] Erro ao criar tag:', err);
                    return;
                }
            } else {
                optionsChanged = value;
            }
        } else {
            optionsChanged = value || [];
        }
        
        // Sempre atualiza o estado visual, mesmo sem contato.id
        if (isMounted.current) {
            setSelecteds(optionsChanged);
        }
        
        // Só sincroniza se o contato já tiver ID (já foi salvo)
        if (contact && contact.id) {
            try {
                await syncTags({ contactId: contact.id, tags: optionsChanged });
            } catch (err) {
                console.error('[TagsContainer] Erro ao sincronizar tags:', err);
            }
        } else {
            // Se o contato ainda não foi salvo, apenas armazena as tags selecionadas
            // Elas serão sincronizadas quando o contato for salvo
            console.log('[TagsContainer] Contato ainda não salvo, tags serão sincronizadas após salvar o contato');
        }
    }

    function getRandomHexColor() {
        // Gerar valores aleatórios para os componentes de cor
        const red = Math.floor(Math.random() * 256); // Valor entre 0 e 255
        const green = Math.floor(Math.random() * 256); // Valor entre 0 e 255
        const blue = Math.floor(Math.random() * 256); // Valor entre 0 e 255
      
        // Converter os componentes de cor em uma cor hexadecimal
        const hexColor = `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
      
        return hexColor;
    }

    console.log('[TagsContainer] Renderizando com', tags.length, 'tags disponíveis e', selecteds.length, 'tags selecionadas');

    return (
        <div style={{ width: '100%', position: 'relative', zIndex: 1 }}>
            <Autocomplete
                multiple
                size="small"
                options={tags}
                value={selecteds}
                freeSolo
                onChange={onChange}
                getOptionLabel={(option) => {
                    if (typeof option === 'string') {
                        return option;
                    }
                    return option?.name || '';
                }}
                isOptionEqualToValue={(option, value) => {
                    if (typeof option === 'string' && typeof value === 'string') {
                        return option === value;
                    }
                    if (!option || !value) return false;
                    return option?.id === value?.id;
                }}
                filterOptions={(options, state) => {
                    // Filtro padrão do Autocomplete
                    const filtered = options.filter((option) => {
                        const label = typeof option === 'string' ? option : option?.name || '';
                        return label.toLowerCase().includes(state.inputValue.toLowerCase());
                    });
                    return filtered;
                }}
                renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                        <Chip
                            key={option?.id || index}
                            variant="outlined"
                            style={{
                                backgroundColor: option?.color || '#eee',
                                color: "#FFF",
                                marginRight: 1,
                                padding: 1,
                                fontWeight: 'bold',
                                paddingLeft: 5,
                                paddingRight: 5,
                                borderRadius: 3,
                                fontSize: "0.8em",
                                whiteSpace: "nowrap"
                            }}
                            label={typeof option === 'string' ? option : option?.name}
                            {...getTagProps({ index })}
                            size="small"
                        />
                    ))
                }
                renderInput={(params) => (
                    <TextField 
                        {...params} 
                        variant="outlined" 
                        placeholder={i18n.t("tags.title")} 
                        fullWidth
                        margin="dense"
                        label={i18n.t("tags.title")}
                    />
                )}
                componentsProps={{
                    popper: {
                        style: {
                            zIndex: 10004
                        },
                        placement: 'bottom-start',
                        modifiers: [
                            {
                                name: 'offset',
                                options: {
                                    offset: [0, 4],
                                },
                            },
                        ],
                    },
                    paper: {
                        style: {
                            zIndex: 10004,
                            textAlign: 'left'
                        }
                    }
                }}
                noOptionsText={tags.length === 0 ? "Carregando tags..." : "Nenhuma tag encontrada. Digite para criar uma nova."}
                loading={tags.length === 0}
                openOnFocus
                ListboxProps={{
                    style: {
                        maxHeight: '300px'
                    }
                }}
            />
        </div>
    )
}