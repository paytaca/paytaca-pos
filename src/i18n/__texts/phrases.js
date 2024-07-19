/**
 * NOTE: separate text objects if it gets too big in size
 * bec the translator has a limit (unspecified in docs)
 * 
 * WHEN ADDING A PHRASE, make sure to not mix dynamic (interpolated) and static strings
 */
const phrases = {
  static: [
    {
      AppVersion: 'App version',
      BranchAddress: 'Branch address',
      DarkMode: 'Dark Mode',
      GoToMarketPlace: 'Go to marketplace',
      PhoneNumber: 'Phone number',
      POSDevice: 'POS Device',
      MerchantDetails: 'Merchant details',
      CurrencySettingNote: 'Currency is set by the wallet owner in Paytaca App',
      Repository: 'Source code repository',
      AppOfflineMessage: 'The app is offline, you will not receive payment notifications.',
      CopyPaymentUri: 'Copied payment URI',
      PaymentComplete: 'Payment Complete',
      QrExpired: 'QR Expired',
      QrRefreshMessage: 'The QR has expired due to BCH price update. Do you wish to refresh it?',
      DetectedDeviceTimeNotMatch: 'Detected that device does not match server time. QR code expiration is adjusted',
      WaitingForPayment: 'Waiting for payment ... ',
      NoTransactionsReceived: 'No transactions received',
      CopiedToClipboard: 'Copied to clipboard',
      LeavePage: 'Leave Page',
      LeavePagePromptMsg: 'Are you sure you want to leave this page without receiving a payment?',
      DetectedOffline: 'Detected offline',
      OfflineDetectionMsg: 'Detected device is offline. Leaving page...',
      LastSevenDays: 'Last 7 days',
      ThisMonth: 'This month',
      InvalidDevice: 'Invalid device',
      InvalidDeviceMsg: 'Linked device does not match',
      InvalidDeviceLabel: 'Link another wallet',
      UnlinkDeviceTitle: 'Unlink device request',
      UnlinkDeviceMsg: 'Merchant requested to unlink device',
      UnlinkDeviceOkMsg: 'Confirm unlink',
      GoHome: 'Go Home',
      PageNotFoundMsg: 'Oops. Nothing here...',
      FirstName: 'First name',
      LastName: 'Last name',
      ChangePassword: 'Change Password',
      CurrentPassword: 'Current Password',
      NewPassword: 'New Password',
      ConfirmNewPassword: 'Confirm New Password',
      ConfirmPassword: 'Confirm Password',
      PasswordDoesntMatch: 'Password does not match',
      UpdatePassword: 'Update Password',
      PasswordUpdate: 'Password update',
      UpdatingPassword: 'Updating password',
      PasswordUpdateSuccessfully: 'Password updated successfully!',
      FormErrorPasswordMsg: 'Encountered error in updating password',
      FilterRoles: 'Filter role/s',
      AdminPermissionErrMsg: 'Sorry, you do not have sufficient admin permissions.',
      RoleUpdateErrorMsg: 'Error encountered in updating roles',
      MarkupPriceRate: 'Markup price rate',
      DefaultReviewer: 'Default Reviewer',
      LastPurchaseOrderNumber: 'Last Purchase Order Number',
      LastSalesOrderNumber: 'Last Sales Order Number',
      SelectsDefaultReviewer: 'Select default reviewer',
      POReviewerFormPlaceholder: 'name / email / username',
      UnableToAssignReviewer: 'Unable to assign reviewer',
      UserNotFound: 'User not found',
      PurchaseOrderNumber: 'Purchase Order Number',
      SalesOrderNumber: 'Sales Order Number',
      UpdateLastPurchaseOrderNumber: 'Update last purchase order number',
      UpdateLastSalesOrderNumber: 'Update last sales order number',
      HideSummary: 'Hide summary',
      ShowSummary: 'Show summary',
      NoPendingOrders: 'No pending orders',
      StoreFrontNotSetup: 'Storefront not setup',
      ShopAccessWarningMsg: 'You do not have access to the shop. Contact a shop admin to grant access.',
    },
    {
      SalesReport: 'Sales Report',
      PurchaseOrders: 'Purchase Orders',
      PurchaseOrder: 'Purchase Order',
      ShopInfo: 'Shop info',
      SetupStorefront: 'Setup storefront',
      ProductName: 'Product name',
      ProductDescription: 'Product description',
      MarkAvailable: 'Mark available',
      MarkUnavailable: 'Mark unavailable',
      MarkupPrice: 'Markup Price',
      CartOptions: 'Cart Options',
      AddonOptions: 'Addon Options',
      RemoveSelectedProductsMsg: 'Removing selected products from storefront, are you sure?',
      RemoveProductsStorefrontMsg: 'Removing products from storefront',
      EncounteredUnknownError: 'Encountered unknown error',
      UnknownError: 'Unknown error',
      CartOptions: 'Cart options',
      CartOptionsUpdated: 'Cart options updated',
      AddonOptionsUpdated: 'Addon options updated',
      AddingProducts: 'Adding products',
      UnableToAddProducts: 'Unable to add products',
      StorefrontSettings: 'Storefront Settings',
      StorefrontSetup: 'Storefront Setup',
      StorefrontUpdated: 'Storefront updated',
      StorefrontCreated: 'Storefront created',
      StayInPage: 'Stay in page',
      CollectionType: 'Collection type',
      NoStorefront: 'No storefront',
      CreateStorefront: 'Create Storefront',
      SignIn: 'Sign-in',
      UsernameOrEmail: 'Username or email',
      FailedToFetchUserData: 'Failed to fetch user data',
      InventoryManager: 'Inventory manager',
      PosDeviceSuspensionMsg: 'POS Device is suspended, contact merchant to unsuspend device',
      FetchingMerchant: 'Fetching merchant...',
      FetchingShop: 'Fetching shop...',
      FetchingUser: 'Fetching user...',
      EnableNotifsToReceiveUpdates: 'Enable notifications to receive updates',
      CustomerNameOrOrderId: 'Customer name / Order ID',
      ViewDetails: 'View details',
      RefundPayment: 'Refund payment',
      RefundingPayment: 'Refunding payment',
      PaymentUpdated: 'Payment updated',
      PaymentRefunded: 'Payment refunded!',
      RefundFailed: 'Refund failed',
      FetchingDetails: 'Fetching details',
      FetchingOrder: 'Fetching order',
    },
    {
      PaymentStatus: 'Payment Status',
      PoItemName: 'PO#, Item name',
      PoItemName2: 'Item name / PO#',
      PoSupplierItemNameCode: 'PO#, Supplier, item name/code',
      HasOngoingDispute: 'Has ongoing dispute',
      ApplyFilter: 'Apply filter',
      ViewPayments: 'View Payments',
      CreatePayment: 'Create Payment',
      CancelOrder: 'Cancel Order',
      ViewEditHistory: 'View edit history',
      UnableToRevertStatus: 'Unable to revert status',
      UnableToRemoveProducts: 'Unable to remove products',
      UnconfirmOrder: 'Unconfirm order',
      RevertToConfirmed: 'Revert to confirmed',
      RevertAsPreparing: 'Revert as preparing',
      PreparationTimer: 'Preparation timer',
      PreparationTimerMessage: 'Complete items in the order and set as ready for pickup on or before timer expires',
      ExtendTime: 'Extend time',
      OrderDispute: 'Order dispute',
      OrderDisputeMsg: 'Order is currently in dispute',
      CustomerReview: 'Customer review',
      OrderReview: 'Order Review',
      UnableToUpdateOrder: 'Unable to update order',
      OpenMap: 'Open Map',
      SearchForRider: 'Search for rider',
      UnassignRider: 'Unassign rider',
      RiderHasAcceptedDelivery: 'Rider has accepted delivery',
      DeliveryStatus: 'Delivery status',
      DeliveryStatusMsg: 'Delivery will not be visible to riders when searching deliveries. Assign a rider or set to public.',
      NoRiderYet: 'No rider yet',
      CreateDeliveryRequest: 'Create delivery request',
      DeliveryFee: 'Delivery fee',
      TotalPaid: 'Total Paid',
      PendingAmount: 'Pending amount',
      PendingAmountMsg: 'Amount sent by customer but not yet received',
      TotalRefunded: 'Total refunded',
      NetPaid: 'Net paid',
      AddPayment: 'Add payment',
      PreparationTime: 'Preparation time',
      ExtendPreparationTime: 'Extend preparation time',
      UnableToUpdatePreparationTime: 'Unable to update preparation time',
      UnableToUupdateStatus: 'Unable to update status',
      ConfirmOrder: 'Confirm order',
      SetOrderPreparationTime: 'Set a preparation time for the order',
      UnableToConfirmOrder: 'Unable to confirm order',
      CancelOrder: 'Cancel order',
      CancelOrderMsg: 'Cancel order, are you sure?',
      UnableToCancelOrder: 'Unable to cancel order',
      DeliveryRequest: 'Delivery request',
      CreatingDeliveryRequest: 'Creating delivery request',
      CreatingPaymentRequest: 'Creating payment request',
      UnableToCreateDeliveryRequest: 'Unable to create delivery request',
      UnableToCreatePaymentRequest: 'Unable to create payment request',
      AssigningRider: 'Assigning rider',
      UnassigningRider: 'Unassigning rider',
      UnableToAssignRider: 'Unable to assign rider',
      UnableToUnassignRider: 'Unable to unassign rider',
      UpdatingDelivery: 'Updating delivery',
      PickupLocation: 'Pickup location',
      DeliveryAddress: 'Delivery address',
      CompletingOrder: 'Completing order',
      ResolveDisputeError: 'Resolve dispute error',
      UnknownErrorOccurred: 'Unknown error occurred',
      ResolvingDispute: 'Resolving dispute',
      ResolveDispute: 'Resolve dispute',
      CompleteOrder: 'Complete order',
      CancelOrder: 'Cancel order',
      OrderCompleteMsg: 'Order will be set as completed after resolving dispute. Continue?',
      OrderCancelMsg: 'Order will be cancelled after resolving dispute. Continue?',
      CollectionType: 'Collection Type',
      DeleteCollection: 'Delete collection',
      RemovingCollection: 'Removing collection',
      CollectionDeleted: 'Collection deleted',
      ThisMonth: 'This month',
      ThisWeek: 'This week',
      Last7Days: 'Last 7 days',
      Last30Days: 'Last 30 days',
      PaymentMode: 'Payment mode',
      RecipientAddress: 'Recipient Address',
      FilterDate: 'Filter date',
      GoToPage: 'Go to page',
      AddProduct: 'Add Product',
      AddProducts: 'Add Products',
    },
    {
      CreateProducts: 'Create Products',
      AddMultipleProducts: 'Add Multiple Products',
      EditProduct: 'Edit Product',
      GoToInventory: 'Go to inventory',
      FilterCategories: 'Filter categories',
      CartOptions: 'Cart options',
      CartOptionsMsg: 'Additional details customers must provide when adding to cart',
      FormPreview: 'Form Preview',
      AddonOptions: 'Addon Options',
      SetAddons: 'Set Addons',
      VariantName: 'Variant Name',
      LargeRedEtc: 'Large / Red / etc.',
      InvalidPrice: 'Invalid price',
      InitialStock: 'Initial Stock',
      CostPrice: 'Cost Price',
      AddVariant: 'Add Variant',
      ProductAdded: 'Product added!',
      ProductsAdded: 'Products added!',
      AddingProductErrMsg: 'Encountered errors in adding product',
      UpdatingProductErrMsg: 'Encountered errors in updating product',
      AddingProductsErrMsg: 'Encountered errors in adding products',
      OpenFrom: 'Open from Excel / CSV / ZIP',
      UploadAFile: 'Upload a file',
      InputForm: 'Input form',
      InputCategories: 'Input categories',
      LoadProductsNote: 'NOTE: Loading a file will overwrite current info in the form',
      LoadProductsData: 'Load products data',
      LoadProductsHint: 'Upload excel / csv / zip file',
      ReadingFile: 'Reading file',
      UnableToReadFile: 'Unable to read file',
      UnableToFetchProduct: 'Unable to fetch product',
      DeleteProduct: 'Delete product',
      UpdateProduct: 'Update Product',
      ProductUpdated: 'Product updated!',
      DeletingProduct: 'Deleting product',
      ProductDeleted: 'Product deleted',
      DeletingProductErrMsg: 'Encountered error in deleting product',
      PaymentAlreadySent: 'Payment already sent', 
      HasExistingTransaction: 'Has existing transaction', 
      NotInPaymentTab: 'Not in payment tab', 
      DraftSaved: 'Draft saved', 
      SaleCreated: 'Sale Created',
      EncounteredError: 'Encountered error',
      FailedToSaveDraft: 'Failed to save draft',
      FailedToCreateSale: 'Failed to create sale',
      DeleteDraft: 'Delete draft',
      DraftSale: 'Draft Sale',
      DeleteDraftMsg1: 'Draft sales order has payment received. Continue?',
      DeleteDraftMsg2: 'Removing draft sales order. Are you sure?',
      StockUpdate: 'Stock Update',
      ExpiresAt: 'Expires At',
      AdjustType: 'Adjust type',
      EditMoreStocks: 'Edit more stocks',
      NoStocksToUpdate: 'No stocks to update',
      UpdatingStocks: 'Updating stocks',
      StocksUpdated: 'Stocks updated',
      StayOnPage: 'Stay on page',
      StocksUpdateError: 'Stocks update error',
      EncounteredErrorInUpdatingStocks: 'Encountered error in updating stocks',
      EncounteredErrorsInUpdatingStocks: 'Encountered errors in updating stocks',
      SetCostPrice: 'Set cost price',
      NoItems: 'No items',
      SearchVariant: 'Search variant',
      AddItem: 'Add Item',
      AddItems: 'Add Items',
      SearchStocks: 'Search stocks',
      NoData: 'No data',
      NoContact: 'No contact',
      NoCostPrice: 'No cost price',
      BuildingNo: 'Building name / Lot number',
      UnitNo: 'Unit No. / Floor No.',
      Address1: 'Address 1',
      Address2: 'Address 2',
      PurchaseOrderCreated: 'Purchase Order created',
      FailedToCreatePurchaseOrder: 'Failed to create purchase order',
      StockRecount: 'Stock Recount',
      SelectMoreStocks: 'Select more stocks',
      UpdateStocks: 'Update stocks',
      StockRecountCreated: 'Stock recount created!',
      StockRecountErrMsg: 'Encountered errors in creating stock recount',
      AssignReviewer: 'Assign reviewer',
      MarkReviewedMsg1: 'All items must be marked as delivered before reviewing',
      MarkReviewedMsg2: 'Reviewing purchase is assigned to another user',
      MarkReviewed: 'Mark reviewed',
      MarkReceived: 'Mark received',
      NotYetDelivered: 'Not yet delivered',
      ViewStocks: 'View stocks',
      SetExpirationDate: 'Set expiration date',
      ExpirationDate: 'Expiration date',
      NameEmailUsername: 'name / email / username',
      AssignedToMe: 'Assigned to me',
      ToReview: 'To review',
    },
    {
      CreatePurchaseOrder: 'Create Purchase Order',
      SetPrice: 'Set price',
      SetExpiry: 'Set expiry',
      RemoveStock: 'Remove stock',
      RemoveStocks: 'Remove stocks',
      RemovingStock: 'Removing stock',
      RemovingStocks: 'Removing stocks',
      RemoveStockErr1: 'Sorry, you do not have sufficient permissions to access the inventory.',
      RemoveStockErr2: 'Failed to remove stock',
      StocksRemoved: 'Stocks removed',
      FailedToRemoveStocks: 'Failed to remove stocks',
      ErrorEncountered: 'Error encountered',
      LinkToWallet: 'Link to Wallet',
      InputLink: 'Input link',
      ScanQrCodeForWalletLink: 'Scan QR code for wallet link',
      WalletLink: 'Wallet link',
      InputWalletLinkCode: 'Input wallet link code',
      QrScannerError: 'QR Scanner error',
      LinkDevice: 'Link device',
      LinkingDevice: 'Linking device',
      DecodingContent: 'Decoding content',
      UnableToDecodeQrData: 'Unable to decode QR data',
      RetrievingLinkCodeData: 'Retrieving link code data',
      LinkCodeDataInvalid: 'Link code data invalid',
      LinkCodeDataNotFound: 'Link code data not found',
      DecryptingXpubkey: 'Decrypting xpubkey',
      LinkDeviceError: 'Link device error',
      UnableToDecryptXpubkey: 'Unable to decrypt xpubkey',
      GeneratingVerifyingXpubkey: 'Generating verifying xpubkey',
      FailedToRetrieveDeviceInformation: 'Failed to retrieve device information',
      UpdatingServer: 'Updating server',
      DeviceLinked: 'Device Linked',
      PosDeviceLinkedSuccessfully: 'POS device linked successfully!',
      FailedToUpdateServer: 'Failed to update server',
      TransactionWasConfirmedOffline: 'Transaction was confirmed offline',
      ReferenceID: 'Reference ID',
      TransactionID: 'Transaction ID',
      MinerFee: 'Miner fee',
      ViewInfo: 'View Info',
      ExplorerLink: 'Explorer Link',
      ViewInExplorer: 'View in explorer',
      SetAmount: 'Set Amount',
      CreatePaymentQR: 'Create Payment QR',
      ScanQrCode: 'Scan QR code',
      TransactionIdCopied: 'Transaction ID Copied',
      AmountErrTitle: 'Amount does not match',
      AmountErrMsg: 'Amount does not match with expected amount. Continue?',
      RemoveImage: 'Remove image',
      ReplaceImage: 'Replace image',
      SelectImage: 'Select image',
      SelectAnotherImage: 'Select another image',
      ProductNameOrCode: 'Product name / code',
      SearchProducts: 'Search products',
      ShowMore: 'Show more',
      PinLocation: 'Pin location',
      UnableToAccessPhotoSelector: 'Unable to access photo selector',
      SelectPhoto: 'Select photo',
      PermissionDenied: 'Permission denied',
      CenterView: 'Center view',
      MessageIsEncrypted: 'Message is encrypted',
      AttachmentEncrypted: 'Attachment encrypted',
      NoAddons: 'No addons',
      AddonOptionsEnabled: 'Some option/s for this addon has textbox enabled',
      SelectionsRequired: 'Selections required',
      MustBeLessThanMax: 'Must be less than max',
      MinimumSelect: 'Minimum select',
      MaximumSelect: 'Maximum select',
      AddChoices: 'Add choices',
      DuplicateValues: 'Duplicate values',
      IncludeTextbox: 'Include textbox',
      IncludeTextboxDescription: 'A textbox will be provided to the customer for additional details when selecting this addon',
      AddonsForm: 'Addons Form',
      RemoveAddon: 'Remove addon',
      ClearList: 'Clear list',
      AreYouSure: 'Are you sure?',
      DuplicateNamesFound: 'Duplicate names found',
      RequiredSelected: 'Required selected',
      JSONForm: 'JSON Form',
      NoFields: 'No fields',
      AddField: 'Add field',
      FieldSettings: 'Field Settings',
      FieldType: 'Field type',
    },
    {
      Property1: 'Property 1',
      Property2: 'Property 2',
      FormPreview2: 'Form (Preview)',
      InputOption: 'Input option',
      UnableToCreateReview: 'Unable to create review',
      NoMessage: 'No message',
      ScanBarcode: 'Scan barcode',
      NoVariantFound: 'No variant found',
      FailedToRetrieveItemDetails: 'Failed to retrieve item details',
      SearchOrScanItem: 'Search / scan item',
      CustomItemName: 'Item name (Custom)',
      AddCustomItem: 'Add custom item',
      SearchItem: 'Search item',
      SearchingItem: 'Searching item',
      ItemName: 'Item name',
      EditItem: 'Edit item',
      RecipientAddressCopied: 'Recipient address copied',
      TransactionCopied: 'Transaction copied',
      UserNotFound: 'User not found',
      RoleSNotFound: 'Role/s not found',
      AddingUserErrorMsg: 'Encountered error in adding user',
      RegisteringUserErrorMsg: 'Encountered errors in registering new user',
      RegistrationSuccessful: 'Registration successful!',
      ProductVariant: 'Product Variant',
      MarkupPrice: 'Markup Price',
      NoInventory: 'No Inventory',
      InStock: 'In Stock',
      AddStock: 'Add Stock',
      VariantNotFound: 'Variant not found',
      AddingStockErrorMsg: 'Encountered errors in adding stock',
      NoStocks: 'No stocks',
      NoInventory: 'No inventory',
      LoadMore: 'Load more',
      NoRecords: 'No records',
      PurchaseOrderHistory: 'Purchase order history',
      ReceiveItems: 'Receive Items',
      StockChanges: 'Stock changes',
      ViewMore: 'View More',
      InsufficientPermissionToAccessInventory: 'Sorry, you do not have sufficient permissions to access the inventory.',
      UpdateStockErrorMsg: 'Error encountered in updating stock',
      UpdatedStocks: 'Updated stocks',
      NoPurchaseOrder: 'No purchase order',
      SelectLanguage: 'Select Language',
      ChineseSimplified: 'Chinese (Simplified)',
      ChineseTraditional: 'Chinese (Traditional)',
      PortugueseBrazil: 'Portuguese (Brazil)',
      SpanishArgentina: 'Spanish (Argentina)',
      FrequentActionErrMsg1: 'You are making frequent actions',
      FrequentActionErrMsg3: '. Try again later',
      SalesOrder: 'Sales Order',
      VoidSale: 'Void Sale',
      PaymentMethod: 'Payment method',
      HasDispute: 'has dispute',
      HasNoDispute: 'has no dispute',
      ProductsMatchAny: 'Products matching any of the conditions',
      ProductsMatchAll: 'Products matching all of the conditions',
      FromSales: 'from sales',
      FromPurchaseOrder: 'from purchase order',
      FromStockRecount: 'from stock recount',
      FromInitialStock: 'from initial stock',
      MustBeGreaterThanOne: 'Must be greater than 1.',
      DeliveryTypes: 'Delivery Types',
      StorePickup: 'Store pickup',
      UpdateBchFiatPrice: 'Track BCH-Fiat Price',
      SomeoneHasScannedQr: 'QR scanned, payment initiated',
      PaymentCancelled: 'Customer has cancelled the payment',
      SendingPayment: 'Customer is sending payment...',
    },
  ],
  dynamic: [
    {
      DeviceTimeAhead: "Device is {value} seconds ahead",
      DeviceTimeBehind: "Device is {value} seconds behind",
      RemoveAddonMsg: "Remove addon '{addonLabel}'. Are you sure?",
      RemoveStockItemMsg: 'Remove stock for "{item}". Are you sure?',
      AddInputValue: 'Add {value}',
      QuantityDisplayText: 'Qty: {totalStocks}',
      VariantIndex: 'Variant {index}',
      NewVariantIndex: 'New Variant {index}',
      ProductIndex: 'Product {index}',
      ProductNumber: 'product#{id}',
      CreatedAt: 'Created at {date}',
      CreatedBy: 'Created by {name}',
      PreviousValue: 'Previous: {value}',
      NewValue: 'New: {value}',
      StockId: 'Stock#{id}',
      stockId: 'stock#{id}',
      ExpectedQty: 'Expected: {quantity}',
      ActualQty: 'Actual: {quantity}',
      FieldIndex: 'Field {index}',
      PriceValue: 'Price: {price}',
      AddItemValue: 'Add item {value}',
      BchPriceAtValue: 'BCH Price at {value}',
      BchLeftValue: '{price} BCH left',
      MarkupSaleRateValue: 'Items are sold with {rate} change from their original price',
      CollectionType: 'Collection Type: {type}',
      StatusValue: 'Status: {value}',
      OrderId: 'Order #{id}',
      DeliveryId: 'Delivery #{id}',
      PickedUpAt: 'Picked up {date}',
      DeliveredAt: 'Delivered {date}',
      SetPrivacy: 'Set {privacy}',
      RevertToStatus: 'Revert to {status}',
      CostPrice: 'Cost price {price} {currency}',
      FrequentActionErrMsg2: '. Try again after {seconds} seconds',
      DeliveredDate: 'Delivered {relativeDate}',
      PendingPurchaseOrderCount: '{count} pending purchase orders',
      OpensAt: 'Opens {date}',
      StaffCount: '{count} staff',
      NumberOfStocks: '{count} {unit}',
      VariantCount: '{count} variants',
      RemoveStocksMsg: 'Removing {count} {unit}. Are you sure?',
      PoNumber: 'PO#{number}',
      SoNumber: 'SO#{number}',
      AddOptionsName: '{name} - Addon Options',
      DeleteProductPromptTitle: "Delete '{name}'",
      DeleteProductPromptMsg: "Delete product '{name}'. Are you sure?",
      PendingOrdersCount: '{pendingOrdersCount} pending order(s)',
      OrderDisputesCount: '{orderDisputesCount} order dispute(s)',
      PaymentsInEscrowCount: '{paymentsInEscrowCount} payment(s) in escrow',
      ProductsCount: '{productsCount} product(s)',
      ItemCount: '{count} item(s)',
      PoNumberItems: 'PO#{number} Items',
      PurchaseOrderCount: '{count} purchase order(s) assigned to you for review',
      ReviewCount: '{count} review(s)',
      RemoveStorefrontProduct: 'Remove {count} product(s) from storefront',
      DeleteCollectionMsg: "Deleting collection '{name}'. Are you sure?",
      ReviewedBy: 'Reviewed by {name} at {date}',
      ReviewedByYou: 'Reviewed by {name} (you) at {date}',
      DateFromTo: '{from} to {to}',
      DateFrom: 'from {from}',
      DateTo: 'to {to}',
      PurchaseOrderReviewed: 'Purchase order reviewed {date}',
      PurchaseOrderReviewedBy: 'Purchase order reviewed {date} by {name}',
      PurchaseOrderReviewedYou: 'Purchase order reviewed {date} by {name} (you)',
      ChangedToFrom: 'Changed from {previousQuantity} to {quantity}',
      ChangedTo: 'Changed to {quantity}',
      DeductedQuantity: 'Deducted {quantity}',
      AddedQuantity: 'Added {quantity}',
    },
  ]
}

module.exports = phrases
