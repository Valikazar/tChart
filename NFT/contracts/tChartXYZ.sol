// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract tChartXYZ is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    uint256 private _tokenIds;

    // Адрес сервера, который подписывает разрешения на минт
    address public signerAddress;

    // Адрес ERC-20 токена (установите позже через setPaymentToken)
    IERC20 public paymentToken;

    // Цены (можно менять)
    uint256 public mintPriceNative = 0 ether; // Сейчас бесплатно или поставьте цену (например 5 ether)
    uint256 public mintPriceToken = 100 * 10**18; // 100 токенов

    // Флаги включения методов оплаты
    bool public isNativePaymentEnabled = true;
    bool public isTokenPaymentEnabled = false;

    // Защита от повторного использования подписи
    mapping(string => bool) public executedNonces;

    event ChartMinted(uint256 indexed tokenId, address indexed to, string paymentType);

    constructor(address _signerAddress) ERC721("tChartXYZ", "TCHART") Ownable(msg.sender) {
        signerAddress = _signerAddress;
    }

    // --- ЛОГИКА ПРОВЕРКИ ПОДПИСИ ---
    function _verifySignature(address to, string memory tokenURI, string memory nonce, bytes memory signature) internal view returns (bool) {
        // Хэш должен совпадать с тем, что генерирует Node.js
        bytes32 messageHash = keccak256(abi.encodePacked(to, tokenURI, nonce, address(this)));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        return ethSignedMessageHash.recover(signature) == signerAddress;
    }

    // --- МИНТ ЗА POL (MATIC) ---
    function mintWithNative(string memory tokenURI, string memory nonce, bytes memory signature) external payable nonReentrant {
        require(isNativePaymentEnabled, "Native payment disabled");
        require(msg.value >= mintPriceNative, "Insufficient POL");
        require(!executedNonces[nonce], "Signature already used");
        require(_verifySignature(msg.sender, tokenURI, nonce, signature), "Invalid signature");

        executedNonces[nonce] = true;
        _mintInternal(msg.sender, tokenURI, "NATIVE");
    }

    // --- МИНТ ЗА ТОКЕНЫ (ERC20) ---
    function mintWithToken(string memory tokenURI, string memory nonce, bytes memory signature) external nonReentrant {
        require(isTokenPaymentEnabled, "Token payment disabled");
        require(address(paymentToken) != address(0), "Payment token not set");
        require(!executedNonces[nonce], "Signature already used");
        require(_verifySignature(msg.sender, tokenURI, nonce, signature), "Invalid signature");

        bool success = paymentToken.transferFrom(msg.sender, address(this), mintPriceToken);
        require(success, "Token transfer failed");

        executedNonces[nonce] = true;
        _mintInternal(msg.sender, tokenURI, "ERC20");
    }

    function _mintInternal(address to, string memory uri, string memory pType) internal {
        _tokenIds++;
        uint256 newTokenId = _tokenIds;
        _mint(to, newTokenId);
        _setTokenURI(newTokenId, uri);
        emit ChartMinted(newTokenId, to, pType);
    }

    // --- УПРАВЛЕНИЕ (ТОЛЬКО ВЛАДЕЛЕЦ) ---
    function setSignerAddress(address _newSigner) external onlyOwner { signerAddress = _newSigner; }
    function setPaymentToken(address _token) external onlyOwner { paymentToken = IERC20(_token); }
    function setPrices(uint256 _native, uint256 _token) external onlyOwner { mintPriceNative = _native; mintPriceToken = _token; }
    function togglePayment(bool _native, bool _token) external onlyOwner { isNativePaymentEnabled = _native; isTokenPaymentEnabled = _token; }
    
    function withdrawNative() external onlyOwner { payable(owner()).call{value: address(this).balance}(""); }
    function withdrawTokens(address _token) external onlyOwner { IERC20(_token).transfer(owner(), IERC20(_token).balanceOf(address(this))); }

    // Overrides
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) { return super.tokenURI(tokenId); }
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) { return super.supportsInterface(interfaceId); }
}
