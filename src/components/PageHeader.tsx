import React, { useState } from 'react';
import { Typography, Box, Button, Menu, MenuItem, ListItemIcon, ListItemText, Link } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TelegramIcon from '@mui/icons-material/Telegram';
import XIcon from '@mui/icons-material/X';
import RedditIcon from '@mui/icons-material/Reddit';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import GroupIcon from '@mui/icons-material/Group';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import HelpIcon from '@mui/icons-material/Help';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import headerImage from '../img/top.jpg';

interface PageHeaderProps {
    isTgSession?: boolean;
    onDonateClick?: () => void;
    onProfileClick?: () => void;
    onUpdateTgClick?: () => void;
}

const PageHeader: React.FC<PageHeaderProps> = ({
    isTgSession = false,
    onDonateClick,
    onProfileClick,
    onUpdateTgClick
}) => {
    const navigate = useNavigate();
    const [socialMenuAnchor, setSocialMenuAnchor] = useState<null | HTMLElement>(null);
    const [botsMenuAnchor, setBotsMenuAnchor] = useState<null | HTMLElement>(null);

    const handleSocialMenuClick = (event: React.MouseEvent<HTMLElement>) => {
        setSocialMenuAnchor(event.currentTarget);
    };

    const handleSocialMenuClose = () => {
        setSocialMenuAnchor(null);
    };

    const handleBotsMenuClick = (event: React.MouseEvent<HTMLElement>) => {
        setBotsMenuAnchor(event.currentTarget);
    };

    const handleBotsMenuClose = () => {
        setBotsMenuAnchor(null);
    };

    return (
        <Box>
            <Typography variant="h3" component="h1" gutterBottom align="center" sx={{ mt: 4, mb: 2 }}>
                tChart Constructor
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
                <img
                    src={headerImage}
                    alt="Chart Constructor Header"
                    style={{ maxWidth: '100%', height: 'auto' }}
                />
            </Box>

            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                mb: 3
            }}>
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 2,
                    flexWrap: 'wrap'
                }}>
                    <Button
                        variant="contained"
                        sx={{
                            backgroundColor: '#FFD700',
                            color: '#CC0000',
                            '&:hover': {
                                backgroundColor: '#FFED4E',
                            }
                        }}
                        onClick={() => navigate('/nft')}
                    >
                        NFT
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<GroupIcon />}
                        endIcon={<ArrowDropDownIcon />}
                        onClick={handleSocialMenuClick}
                    >
                        Socials
                    </Button>
                    <Menu
                        anchorEl={socialMenuAnchor}
                        open={Boolean(socialMenuAnchor)}
                        onClose={handleSocialMenuClose}
                        disableAutoFocus
                        disableEnforceFocus
                    >
                        <MenuItem
                            component={Link}
                            href="https://x.com/tChartxyz"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handleSocialMenuClose}
                        >
                            <ListItemIcon>
                                <XIcon />
                            </ListItemIcon>
                            <ListItemText>X.COM</ListItemText>
                        </MenuItem>
                        <MenuItem
                            component={Link}
                            href="https://www.reddit.com/r/tChartXYZ/"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handleSocialMenuClose}
                        >
                            <ListItemIcon>
                                <RedditIcon />
                            </ListItemIcon>
                            <ListItemText>Reddit</ListItemText>
                        </MenuItem>
                        <MenuItem
                            component={Link}
                            href="https://t.me/+zmVF57OMK2k1OTNi"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handleSocialMenuClose}
                        >
                            <ListItemIcon>
                                <TelegramIcon />
                            </ListItemIcon>
                            <ListItemText>Telegram</ListItemText>
                        </MenuItem>
                        <MenuItem
                            component={Link}
                            href="https://discord.gg/X9Zx7WsuR3"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handleSocialMenuClose}
                        >
                            <ListItemIcon>
                                <SportsEsportsIcon />
                            </ListItemIcon>
                            <ListItemText>Discord</ListItemText>
                        </MenuItem>
                    </Menu>

                    <Button
                        variant="contained"
                        color="info"
                        startIcon={<SmartToyIcon />}
                        endIcon={<ArrowDropDownIcon />}
                        onClick={handleBotsMenuClick}
                    >
                        Bots
                    </Button>
                    <Menu
                        anchorEl={botsMenuAnchor}
                        open={Boolean(botsMenuAnchor)}
                        onClose={handleBotsMenuClose}
                        disableAutoFocus
                        disableEnforceFocus
                    >
                        <MenuItem
                            component={Link}
                            href="https://t.me/tChartXYZ_bot"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handleBotsMenuClose}
                        >
                            <ListItemIcon>
                                <TelegramIcon />
                            </ListItemIcon>
                            <ListItemText>TG Bot</ListItemText>
                        </MenuItem>
                        <MenuItem
                            component={Link}
                            href="https://discord.com/oauth2/authorize?client_id=1378000611693428848&permissions=2147600384&integration_type=0&scope=bot+applications.commands"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handleBotsMenuClose}
                        >
                            <ListItemIcon>
                                <SportsEsportsIcon />
                            </ListItemIcon>
                            <ListItemText>DC Bot</ListItemText>
                        </MenuItem>
                        <MenuItem
                            component={Link}
                            href="https://developers.reddit.com/apps/tchartxyz"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handleBotsMenuClose}
                        >
                            <ListItemIcon>
                                <RedditIcon />
                            </ListItemIcon>
                            <ListItemText>Reddit App</ListItemText>
                        </MenuItem>
                    </Menu>

                    <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<HelpIcon />}
                        component={Link}
                        href="/help.html"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Help
                    </Button>

                    <Button
                        variant="contained"
                        color="success"
                        startIcon={<VolunteerActivismIcon />}
                        onClick={onDonateClick}
                    >
                        Donate
                    </Button>

                    <ConnectButton
                        showBalance={false}
                        accountStatus={{ smallScreen: 'avatar', largeScreen: 'address' }}
                        chainStatus={{ smallScreen: 'icon', largeScreen: 'icon' }}
                        label="Wallet"
                    />
                    <Button
                        variant="outlined"
                        color="primary"
                        onClick={onProfileClick}
                    >
                        Profile
                    </Button>

                </Box>

                {isTgSession && (
                    <Button
                        variant="contained"
                        color="error"
                        size="large"
                        onClick={onUpdateTgClick}
                        sx={{
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            py: 1.5,
                            px: 4
                        }}
                    >
                        UPDATE TG/DC BOTs
                    </Button>
                )}
            </Box>
        </Box>
    );
};

export default PageHeader;
