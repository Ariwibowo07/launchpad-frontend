import { parseAbi } from 'viem'

export const factoryAbi = [
  ...parseAbi([
    'function launchFee() view returns (uint256)',
    'function canLaunch(address launcher) view returns (bool)',
    'function previewLaunchEconomics(uint256 launchConfigId, address pairToken) view returns (bytes32)',
    'function createGraduatedPool(address token) returns (uint256)',
    'error NotWhitelisted()',
    'error LaunchFeeNotPaid()',
    'error LaunchEconomicsMismatch(bytes32 expected, bytes32 actual)',
    'error InvalidTokenParams()',
    'error NotReadyToGraduate()',
    'error WrongGraduationPhase()',
  ]),
  {
    type: 'function',
    name: 'getLaunchedToken',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'token', type: 'address' },
          { name: 'curve', type: 'address' },
          { name: 'deployer', type: 'address' },
          { name: 'creatorFeeRecipient', type: 'address' },
          { name: 'pairToken', type: 'address' },
          { name: 'graduationThreshold', type: 'uint256' },
          { name: 'poolFee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'creatorTaxBps', type: 'uint16' },
          { name: 'buybackEnabled', type: 'bool' },
          { name: 'phase', type: 'uint8' },
          { name: 'sweptQuote', type: 'uint256' },
          { name: 'sweptTokens', type: 'uint256' },
          { name: 'sweptAt', type: 'uint256' },
          { name: 'exists', type: 'bool' },
        ],
      },
    ],
  },
] as const

export const tokenLaunchedEvent = {
  type: 'event',
  name: 'TokenLaunched',
  inputs: [
    { name: 'token', type: 'address', indexed: true },
    { name: 'curve', type: 'address', indexed: true },
    { name: 'deployer', type: 'address', indexed: true },
    { name: 'pairToken', type: 'address', indexed: false },
    { name: 'launchConfigId', type: 'uint256', indexed: false },
    { name: 'graduationThreshold', type: 'uint256', indexed: false },
  ],
} as const

export const curveAbi = parseAbi([
  'function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)',
  'function realQuoteReserve() view returns (uint256)',
  'function graduationThreshold() view returns (uint256)',
  'function feeBps() view returns (uint256)',
  'function creatorTaxBps() view returns (uint256)',
  'function currentSnipeTaxBps(address recipient) view returns (uint256)',
  'function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) payable returns (uint256 tokensOut)',
  'function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) returns (uint256)',
  'event CurveBuy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax)',
  'event CurveBuyRefunded(address indexed buyer, uint256 refund)',
  'error SlippageExceeded(uint256 actual, uint256 minimum)',
  'error CurveGraduated()',
  'error AlreadyGraduated()',
  'error ZeroAmount()',
  'error InsufficientInputAmount()',
  'error InsufficientOutputAmount()',
  'error InsufficientLiquidity()',
  'error MinimumOutputRequired()',
  'error NativeValueMismatch(uint256 supplied, uint256 expected)',
  'error UnexpectedNativeValue()',
  'error TransferFailed()',
])

export const tokenAbi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function logo() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)',
])
