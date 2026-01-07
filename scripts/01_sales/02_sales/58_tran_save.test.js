import { group, sleep } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CARD } from "../../../common/constant/card.js";
import { TestHelper } from "../../../common/test_helper.js";
import { CommonFunction } from "../../../common/common_function.js";
import { COUPON } from "../../../common/constant/coupon.js";
import { TAX } from "../../../common/constant/tax.js";
import { Formular } from "../../../common/formular.js";
import { CASH_TYPE } from "../../../common/constant/cash_type.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 売上_プリペポイント付与
 * @memberof 売上点検.取引別レポート
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES_INSPECTION}
 * {@link TAGS.SALES}
 * {@link TAGS.POINT}
 * {@link TAGS.REPORT_BY_TRANSACTION}
 * {@link TAGS.SUBTOTAL}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.JOURNAL_SAVE}
 * {@link TAGS.TAG_500_YEN_TICKET_ISSUE}
 * ### テスト観点
 * * 表右のテーブル設計書に挙げたトランがすべて保存されているか確認する
 * * トランの値のチェックは下記に対して行う
 * * 売上トラン
 * * * ・合計売上額
 * * * ・合計税対象金額
 * * * ・合計税額
 * * 支払トラン
 * * * ・支払額
 * * * ・おつり額
 * * * ・支払トラン自由項目
 * * ポイント付与トラン
 * * * ・付与ポイント
 * * * ・利用ポイント
 * * * ・ポイント対象額
 * * ポイント_TMNプリペトラン
 * * * ・ポイント付与分のレコード
 * * * ・ポイント利用分のレコード
 * * クーポン_発券明細トラン
 * * 領収証トラン
 * * * ・発行対象金額
 * * 金券_発券明細トラン
 * * * ・500円券発券枚数に応じたレコード数が保存される
 * * 電子ジャーナルトラン
 * * * ・レシートxmlに付与ポイントが印字されている
 * * * ・500円券が発券される
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 0 | AOKカードのポイントを0に調整 | - |
 * | 1 |  取引開始 sales`/begin` | - |
 * | 2 | 会員登録 sales`/cart/barcode` | - |
 * | 3 | ポイント1倍商品 sales`/cart/barcode` | - |
 * | 4 | ポイント3倍商品 sales`/cart/barcode` | - |
 * | 5 | ポイント対象外商品 sales`/cart/barcode` | - |
 * | 6 | 通常商品 sales`/cart/barcode` | - |
 * | 7 | 単品値引 sales`/cart/unitdiscount` | - |
 * | 8 | 通常商品 sales`/cart/barcode` | - |
 * | 9 | 売価変更 sales`/cart/changeitemprice` | - |
 * | 10 | 超トク対象商品 sales`/cart/barcode` | - |
 * | 11 | ポイント0倍商品 sales`/cart/barcode` | - |
 * | 12 | 書籍 sales`/cart/barcode` | - |
 * | 13 | 数量限定値引 sales`/cart/barcode` | - |
 * | 14 | まとめ値引対象商品A sales`/cart/barcode` | - |
 * | 15 | まとめ値引対象商品B sales`/cart/barcode` | - |
 * | 16 | まとめ値引対象商品C sales`/cart/barcode` | - |
 * | 17 | 明細削除（まとめ値引対象商品B） sales`/cart/deleteitem` | - |
 * | 18 | 年齢確認商品 sales`/cart/barcode` | - |
 * | 19 | 年齢確認 sales`/age-verification` | - |
 * | 20 | ボーナスポイント対象商品 sales`/cart/barcode` | - |
 * | 21 | 株主優待 sales`/cart/barcode` | - |
 * | 22 | 小計 sales`/subtotal` | - |
 * | 23 | 現金支払 sales`/addpayment` | - |
 * | 24 | 取引完了 sales`/end` | - |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 会員登録: 8090227000000006, 操作シーン区分: 8
 * * 2. ポイント1倍商品: 4500000000110, 操作シーン区分: 2
 * * 3. ポイント3倍商品: 4500000000111 
 * * 4. ポイント対象外商品: 4911110703005
 * * 5. 通常商品: 1050000011001
 * * 6.  単品値引: [商品明細番号: 0 , 値引の種類: 売価指定, 値引率(額): 40]
 * * 7. 変更する売価: 50000
 * * 8. 超トク対象商品: 4500000000077
 * * 9. ポイント0倍商品: 4911111111012
 * * 10. 書籍: 9784799313282, 1921234010008
 * * 11. 数量限定値引: 4500000000056
 * * 12. まとめ値引対象商品A: 4500000000112
 * * 13. まとめ値引対象商品B: 4500000000113
 * * 14. まとめ値引対象商品C: 4500000000114
 * * 15. 年齢確認商品: 09450000000014820200
 * * 16. ボーナスポイント対象商品: 4520230413004
 * * 17. 株主優待: K20180900, 株主優待バーコード体系: Code39
 * * 18. 現金支払 : [支払グループコード: 0100, 支払コード: 0101, 支払額: 支払残額, 支払明細詳細情報: "]
 * * 19. レシートタイプ : 2
 * * 20. ポイント基準額: 100
 * * 21. ポイント（500 円) :500
 * * 22: 超トク対象 : 100
 * * 23. ボーナスポイント:60
 * 
 * ---
 * ### 期待結果
 * * ※実行結果と期待値が一致しない
 * * 以下の処理・値は間違いがあると思います。
 * * 1. t_sales_detail_subtotal_discount_over_upper_limit_item にデータが保存される
 * * 2. total_sales_amountのデータ
 * * 3. total_tax_amountのデータ
 * * 4. t_payment.paid_amountのデータ
 * * 5. t_payment.payment_free_areaのデータ
 * * 6. target_amountのデータ
 * * #### 24. 取引完了 sales`/end`
 * * \- トランザクションデータは以下のテーブルに保存できたか確認する(store_cd, pos_cd, response.receipt_no と response.business_day フィールドで確認する)
 * * * \+ ms-sales.t_sales
 * * * \+ ms-sales.t_sales_detail_item
 * * * \+ ms-sales.t_sales_detail_unit_discount
 * * * \+ ms-sales.t_sales_detail_item_voucher_discount
 * * * \+ ms-sales.t_sales_detail_item_book
 * * * \+ ms-sales.t_sales_detail_tax
 * * * \+ ms-sales.t_sales_detail_subtotal_discount
 * * * \+ ms-sales.t_sales_detail_subtotal_discount_item
 * * * \+ ms-sales.t_sales_detail_subtotal_discount_over_upper_limit_item
 * * * \+ ms-sales.t_sales_detail_subtotal_discount_coupon
 * * * \+ ms-sales.t_sales_detail_formal_receipt
 * * * \+ ms-sales.t_sales_detail_confirmation
 * * * \+ ms-sales.t_payment
 * * * \+ ms_sales.t_payment_voucher
 * * * \+ ms-sales.t_payment_cash
 * * * \+ ms-sales.t_cash_flow
 * * * \+ ms-sales.t_point
 * * * \+ ms-sales.t_point_detail_point
 * * * \+ ms-sales.t_point_detail_point_item
 * * * \+ ms-sales.t_point_cupon
 * * * \+ ms-sales.t_coupon_issue_detail
 * * * \+ ms-sales.t_point_tmn_prepaid
 * * * \+ ms-sales.t_point_tmn_prepaid_plan
 * * * \+ ms-sales.t_voucher_issue_detail
 * * * \+ ms_tmn_prepaid. t_tmn_prepaid_trade_number
 * * * \+ ms-pos-receipt.t_ejournal
 * * * \+ ms-pos-receipt.t_ejournal_payment
 * * * \+ ms-pos-receipt.t_ejournal_payment_detail
 * * * \+ ms-pos-receipt.t_ejournal_sales
 * * * \+ ms-pos-receipt.t_ejournal_sales_detail_item
 * * * \+ ms-pos-receipt.t_ejournal_sales_detail_unit_discount
 * * * \+ ms-pos-receipt.t_ejournal_sales_detail_subtotal_discount
 * * * \+ ms-pos-receipt.t_receipt_no
 * * \- DBのデータを確認する
 * * Sheet Formulaでの式を利用
 * * * \+ ms_sales.t_sales.total_sales_amount = calcTotalSalesAmount() = 62970 (*)
 * * * \+ ms_sales.t_sales.total_taxable_amount = calcTotalTaxableAmount() = 58074 (")
 * * * \+ ms_sales.t_sales.total_tax_amount = calcTotalTaxAmount() = 4729
 * * * \+ ms_sales.t_payment.paid_amount は2つのレコードがある
 * * * * \. 超トク対象商品 = 超トク対象 = 100
 * * * * \. 現金支払 = total_sales_amount - 超トク対象 = 62790 - 100 = 62690
 * * * \+ ms_sales.t_payment.change_amount は2つのレコードがある
 * * * * \. 超トク対象商品 = 0
 * * * * \. 現金支払 = 0
 * * * \+ ms_sales.t_payment.payment_free_area は2つのレコードがある
 * * * * \. 超トク対象商品 = 0/超トク対象商品.display_unit_price`/0` = 0`/1000/0`
 * * * * \. 現金支払 = "
 * * * \+ ms_sales.t_point.add_point = calcTotalAddPoint(cartinfo, ポイント基準額, ボーナスポイント) = 608 (*)
 * * * \+ ms_sales.t_point.used_point = = Math.trunc(calcTotalAddPoint(cartinfo, ポイント基準額, ボーナスポイント) / point500Yen) * point500Yen = 500
 * * * \+ ms_sales.t_point.point_target_item_amount = calcPointTargetItemAmount(cartinfo) =  54684 (*)
 * * * \+ ms_sales.t_point_tmn_prepaid.addition_point_count_sum は２つのレコードがある
 * * * * \. レコード add point = calcTotalAddPoint(cartinfo, ポイント基準額, ボーナスポイント) = 608 (*)
 * * * * \. レコード used point = 0
 * * * \+ ms_sales.t_point_tmn_prepaid.usage_point_count_sum は2つのレコードがある
 * * * * \. レコード add point = 0
 * * * * \. レコード used point = = Math.trunc(calcTotalAddPoint(cartinfo, ポイント基準額, ボーナスポイント)/ point500Yen) * point500Yen = 500
 * * * \+ ms_sales.t_sales_detail_formal_receipt.target_amount = calcTotalSalesAmount(cartinfo.items) = 62790 (*)
 * * * \+ ms_sales.t_voucher_issue_detail は1つのレコードがある
 * * * \+ ms_pos_receipt.t_ejournal.print_data に [５００円  お買物券] and [608p]のデータがある
 */
export function TC_010258001_AwardPrepaidPointsForSales() {
  group("TC_010258001 売上_プリペポイント付与", () => {
    const step = {
      certification: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      usePointAoka: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_USE_POINT),
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "会員登録"),
      barcodePointX1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント1倍商品"),
      barcodePointX3: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント3倍商品"),
      barcodeNonBonusPoint: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象外商品"),
      barcodeRegular2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品"),
      unitDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_UNIT_DISCOUNT),
      barcodeRegular2Second: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品 (2)"),
      changePrice: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE),
      barcodeSuperBargain: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "超トク対象商品"),
      barcodePointX0: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント0倍商品"),
      barcodeBookTwoTier: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "書籍"),
      barcodeLimitedQuantityDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "数量限定値引"),
      barcodeMixMatchDiscountA: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "まとめ値引対象商品A"),
      barcodeMixMatchDiscountB: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "まとめ値引対象商品B"),
      barcodeMixMatchDiscountC: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "まとめ値引対象商品C"),
      deleteItem: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_DELETE_ITEM, "明細削除（まとめ値引対象商品B）"),
      barcodeAgeRestricted: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "年齢確認商品"),
      ageVerification: CommonFunction.getFullDesc(ENDPOINT.SALES_AGE_VERIFICATION),
      barcodeBonusPoint: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ボーナスポイント対象商品"),
      barcodeShareholderBenefits: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      addPayment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      getTradeNumber: CommonFunction.getFullDesc(ENDPOINT.GET_TRADE_NUMBER),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA),
      getReceiptNo: CommonFunction.getFullDesc(ENDPOINT.GET_RECEIPT_NO),
      getPosReceiptData: CommonFunction.getFullDesc(ENDPOINT.POS_RECEIPT_DATA_TRAN_GET_DATA),
      verifyTransactionsExist: "Verify Transactions Exist",
      verifyTransactionsValues: "Verify Transactions Values",
    };

    let totalAddPoint = null;
    let cartInfo = null;
    let totalSalesAmount = 0;

    // Defined in test data
    const superBargainPaidAmount = 100; // 超トク対象
    const pointStandardAmount = 100; // ポイント基準額
    const bonusPoints = 60; // ボーナスポイント
    const point500Yen = 500;

    // Set the point of Aok card to 0
    // 認証 /tpi_v1/terminal/generatekey
    TestHelper.tmnPrepaidCertification(step.certification, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 残高照会 /tpi_v1/holder/getbalance
    const point = TestHelper.tmnPrepaidGetBalance(step.getBalance, {
      cardNo: CARD.AOKI_PREPAID.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.point_count_sum;

    // ポイント利用 /tpi_v1/settlement/usepoint
    if (point > 0) {
      TestHelper.settlementUsePoint(step.usePointAoka, {
        cardNo: CARD.AOKI_PREPAID.CODE,
        receiptNo: ENVIRONMENT.TMN_PREPAID_RECEIPT_NO,
        usagePointCount: point,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    }

    // 取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 会員登録 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeAokiPrepaid, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: 8,
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    // ポイント1倍商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodePointX1, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_X1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイント3倍商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodePointX3, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_X3,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイント対象外商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeNonBonusPoint, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NON_BONUS_POINT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 通常商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeRegular2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 単品値引 sales/cart/unitdiscount
    TestHelper.salesCartUnitDiscount(step.unitDiscount, {
      cartNo,
      statementNo: 0,
      discountType: "2",
      discountValue: 40,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 通常商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeRegular2Second, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 売価変更 sales/cart/changeitemprice
    TestHelper.salesCartChangeItemPrice(step.changePrice, {
      cartNo,
      statementNo: 0,
      updatedPrice: 50000,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 超トク対象商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeSuperBargain, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SUPER_BARGAIN,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイント0倍商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodePointX0, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_X0,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 書籍 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeBookTwoTier, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.BOOK_TWO_TIER_1,
          scan_data_type: "JAN13",
        },
        {
          barcode: PROD.BOOK_TWO_TIER_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 数量限定値引 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeLimitedQuantityDiscount, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.LIMITED_QUANTITY_DISCOUNT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // まとめ値引対象商品A sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeMixMatchDiscountA, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_DISCOUNT_A,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // まとめ値引対象商品B sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeMixMatchDiscountB, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_DISCOUNT_B,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // まとめ値引対象商品C sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeMixMatchDiscountC, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_DISCOUNT_C,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 明細削除（まとめ値引対象商品B） sales/cart/deleteitem
    TestHelper.salesCartDeleteItem(step.deleteItem, {
      cartNo,
      statementNo: 10,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 年齢確認商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeAgeRestricted, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.AGE_RESTRICTED,
          scan_data_type: "Code128",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 年齢確認 sales/age-verification
    TestHelper.salesAgeVerification(step.ageVerification, {
      cartNo,
      operateEmployeeCd: "10000020",
      isVerified: true,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ボーナスポイント対象商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeBonusPoint, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.BONUS_POINT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 株主優待 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeShareholderBenefits, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.SHAREHOLDER_BENEFITS.CD,
          scan_data_type: "Code39",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 小計 sales/subtotal
    cartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;
    totalSalesAmount = Formular.calcTotalSalesAmount(cartInfo?.items);
    const totalBalanceAmount = cartInfo?.total_balance_amount;

    totalAddPoint = Formular.calcTotalAddPoint({
      cartinfo: cartInfo,
      pointStandardAmount,
      bonusPoints,
    });

    // 現金支払 sales/addpayment
    TestHelper.salesAddPayment(step.addPayment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
      totalBalanceAmount,
      details: "",
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 取引完了 sales/end
    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    //3秒待機
    sleep(3);

    const businessDay = salesEndResponse.result?.business_day;
    const receiptNo = salesEndResponse.result?.receipt_no;

    // 現在の データベース上の TradeNumber を取得
    const tradeNumberDatabase = TestHelper.getTradeNumber(step.getTradeNumber, [
      CHECK.createStatusCodeCheck(),
    ]).result?.tradeNumberDict?.TmnPrepaid;

    const salesDataRes = TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 現在の データベース上の ReceiptNo を取得
    const receiptNoResponse = TestHelper.getReceiptNo(step.getReceiptNo, [
      CHECK.createStatusCodeCheck(),
    ]);
    const receiptNoDatabase = receiptNoResponse.result;

    const posReceiptDataRes = TestHelper.getPosReceiptData(step.getPosReceiptData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // Verify Transaction
    TestHelper.runGroupWithoutApi(step.verifyTransactionsExist, [
      {
        res: salesDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_sales",
            expected: true,
            actual: (res) => res.result?.sales?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_sales_detail_item",
            expected: true,
            actual: (res) => res.result?.salesDetailItems?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_sales_detail_unit_discount",
            expected: true,
            actual: (res) => res.result?.salesDetailUnitDiscounts?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_sales_detail_item_voucher_discount",
            expected: true,
            actual: (res) => res.result?.salesDetailItemVoucherDiscounts?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_sales_detail_item_book",
            expected: true,
            actual: (res) => res.result?.salesDetailItemBooks?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_sales_detail_tax",
            expected: true,
            actual: (res) => res.result?.salesDetailTaxes?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_sales_detail_subtotal_discount",
            expected: true,
            actual: (res) => res.result?.salesDetailSubtotalDiscounts?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_sales_detail_subtotal_discount_item",
            expected: true,
            actual: (res) => res.result?.salesDetailSubtotalDiscountItems?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_sales_detail_subtotal_discount_over_upper_limit_item",
            expected: true,
            actual: (res) => res.result?.salesDetailSubtotalDiscountOverUpperLimitItems?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_sales_detail_subtotal_discount_coupon",
            expected: true,
            actual: (res) => res.result?.salesDetailSubtotalDiscountCoupons?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_sales_detail_formal_receipt",
            expected: true,
            actual: (res) => res.result?.salesDetailFormalReceipts?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_sales_detail_confirmation",
            expected: true,
            actual: (res) => res.result?.salesDetailConfirmations?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_payment",
            expected: true,
            actual: (res) => res.result?.payments?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_payment_voucher",
            expected: true,
            actual: (res) => res.result?.paymentVouchers?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_payment_cash",
            expected: true,
            actual: (res) => res.result?.paymentCashes?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_cash_flow",
            expected: true,
            actual: (res) => res.result?.cashFlows?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_point",
            expected: true,
            actual: (res) => res.result?.points?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_point_detail_point",
            expected: true,
            actual: (res) => res.result?.pointDetailPoints?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_point_detail_point_item",
            expected: true,
            actual: (res) => res.result?.pointDetailPointItems?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_point_cupon",
            expected: true,
            actual: (res) => res.result?.pointCoupons?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_coupon_issue_detail",
            expected: true,
            actual: (res) => res.result?.couponIssueDetails?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_point_tmn_prepaid",
            expected: true,
            actual: (res) => res.result?.pointTmnPrepaids?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_point_tmn_prepaid_plan",
            expected: true,
            actual: (res) => res.result?.pointTmnPrepaidPlans?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_voucher_issue_detail",
            expected: true,
            actual: (res) => res.result?.voucherIssueDetails?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_tmn_prepaid_trade_number",
            expected: true,
            actual: (res) => tradeNumberDatabase >= res.result?.pointTmnPrepaids?.[0]?.tradeNumber,
          }),
        ],
      },
      {
        res: posReceiptDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_ejournal",
            expected: true,
            actual: (res) => res.result?.ejournals?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_ejournal_payment",
            expected: true,
            actual: (res) => res.result?.ejournalPayments?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_ejournal_payment_detail",
            expected: true,
            actual: (res) => res.result?.ejournalPaymentDetails?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_ejournal_sales",
            expected: true,
            actual: (res) => res.result?.ejournalSales?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_ejournal_sales_detail_item",
            expected: true,
            actual: (res) => res.result?.ejournalSalesDetailItems?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_ejournal_sales_detail_unit_discount",
            expected: true,
            actual: (res) => res.result?.ejournalSalesDetailUnitDiscounts?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_ejournal_sales_detail_subtotal_discount",
            expected: true,
            actual: (res) => res.result?.ejournalSalesDetailSubtotalDiscounts?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_receipt_no",
            expected: true,
            actual: receiptNoDatabase >= receiptNo,
          }),
        ],
      },
    ]);

    // Verify Database Data
    TestHelper.runGroupWithoutApi(step.verifyTransactionsValues, [
      {
        res: salesDataRes,
        checks: [
          // 確認対象トラン:下表の「確認対象トラン」に記載した値が正しく保存されているかを確認する
          CHECK.createEqualsCheck({
            name: "Verify data: total_sales_amount",
            expected: totalSalesAmount,
            actual: (res) => res.result?.sales?.[0]?.totalSalesAmount,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: total_taxable_amount",
            expected: Formular.calcTotalTaxableAmount(cartInfo?.items),
            actual: (res) => res.result?.sales?.[0]?.totalTaxableAmount,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: total_tax_amount",
            expected: Formular.calcTotalTaxAmount(cartInfo?.items),
            actual: (res) => res.result?.sales?.[0]?.totalTaxAmount,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: t_payment.paid_amount has 2 records",
            expected: {
              paidAmount1: superBargainPaidAmount,
              paidAmount2: Formular.calcTotalSalesAmount(cartInfo?.items) - superBargainPaidAmount,
            },
            actual: (res) => {
              return {
                paidAmount1: res.result?.payments?.[0]?.paidAmount,
                paidAmount2: res.result?.payments?.[1]?.paidAmount,
              };
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: t_payment.change_amount has 2 records",
            expected: {
              changeAmount1: 0,
              changeAmount2: 0,
            },
            actual: (res) => {
              return {
                changeAmount1: res.result?.payments?.[0]?.changeAmount,
                changeAmount2: res.result?.payments?.[1]?.changeAmount,
              };
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: t_payment.payment_free_area has 2 records",
            expected: {
              paymentFreeArea1: `0/${cartInfo?.items?.[5]?.display_unit_price}/0`,
              paymentFreeArea2: "",
            },
            actual: (res) => {
              return {
                paymentFreeArea1: res.result?.payments?.[0]?.paymentFreeArea,
                paymentFreeArea2: res.result?.payments?.[1]?.paymentFreeArea,
              };
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: t_point.add_point",
            expected: totalAddPoint,
            actual: (res) => res.result?.points?.[0]?.addPoint,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: t_point.used_point",
            expected: Math.trunc(totalAddPoint / point500Yen) * point500Yen,
            actual: (res) => res.result?.points?.[0]?.usedPoint,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: t_point.point_target_item_amount",
            expected: Formular.calcPointTargetItemAmount({
              cartinfo: cartInfo,
            }),
            actual: (res) => res.result?.points?.[0]?.pointTargetItemAmount,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: t_point_tmn_prepaid.addition_point_count_sum has 2 records",
            expected: {
              additionPointCountSum1: totalAddPoint,
              additionPointCountSum2: 0,
            },
            actual: (res) => {
              return {
                additionPointCountSum1: res.result?.pointTmnPrepaids?.[0]?.additionPointCountSum,
                additionPointCountSum2: res.result?.pointTmnPrepaids?.[1]?.additionPointCountSum,
              };
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: t_point_tmn_prepaid.usage_point_count_sum has 2 records",
            expected: {
              usagePointCountSum1: 0,
              usagePointCountSum2: Math.trunc(totalAddPoint / point500Yen) * point500Yen,
            },
            actual: (res) => {
              return {
                usagePointCountSum1: res.result?.pointTmnPrepaids?.[0]?.usagePointCountSum,
                usagePointCountSum2: res.result?.pointTmnPrepaids?.[1]?.usagePointCountSum,
              };
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: target_amount ",
            expected: totalSalesAmount,
            actual: (res) => res.result?.salesDetailFormalReceipts?.[0]?.targetAmount,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: 500円券発券枚数に応じたレコード数が保存される ",
            expected: Math.trunc(totalAddPoint / point500Yen),
            actual: (res) => res.result?.voucherIssueDetails?.length,
          }),
        ],
      },
      {
        res: posReceiptDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data: レシートxmlに付与ポイントが印字されている",
            expected: true,
            actual: (res) => CommonFunction.includesItems([
              `${totalAddPoint}p`,
            ], res.result?.ejournals?.[res.result?.ejournals?.length - 1]?.printData),
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: 500円券が発券される",
            expected: true,
            actual: (res) => CommonFunction.includesItems([
              "５００円  お買物券",
            ], res.result?.ejournals[0]?.printData),
          }),
        ],
      },
    ]);
  });
}

/**
 * @function 売上_プリペポイント付与失敗
 * @memberof 売上点検.取引別レポート
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES_INSPECTION}
 * {@link TAGS.SALES}
 * {@link TAGS.POINT}
 * {@link TAGS.REPORT_BY_TRANSACTION}
 * {@link TAGS.SUBTOTAL}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.JOURNAL_SAVE}
 * {@link TAGS.TAG_500_YEN_TICKET_ISSUE}
 * ### テスト観点
 * * ポイント処理失敗トラン
 * * * ・ポイント付与分のレコード
 * * * ・ポイント利用分のレコード
 * * ポイント処理失敗_TMNプリペトラン
 * * * ・ポイント付与分のレコード
 * * * ・ポイント利用分のレコード
 * * 金券_発券明細トラン
 * * 電子ジャーナルトラン
 * * * ・レシートxmlに、ポイントが後日反映されることが印字されている
 * * * ・500円券が発券される
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 0 | 事前準備 | - |
 * | 0.1 | プリペのポイント付与を強制的に失敗させる tmn-api-test`/set-api-timeout` | - |
 * | 0.2 | AOKカードのポイントを0に調整 | - |
 * | 1 | 取引開始 sales`/begin` | - |
 * | 2 | 会員登録 sales`/cart/barcode` | - |
 * | 3 | ポイント1倍商品 sales`/cart/barcode` | - |
 * | 4 |  ポイント3倍商品 sales`/cart/barcode` | - |
 * | 5 | ポイント対象外商品 sales`/cart/barcode` | - |
 * | 6 | 通常商品 sales`/cart/barcode` | - |
 * | 7 | 単品値引 sales`/cart/unitdiscount` | - |
 * | 8 | 通常商品 sales`/cart/barcode` | - |
 * | 9 | 売価変更 sales`/cart/changeitemprice` | - |
 * | 10 | 超トク対象商品 sales`/cart/barcode` | - |
 * | 11 | ポイント0倍商品 sales`/cart/barcode` | - |
 * | 12 | 書籍 sales`/cart/barcode` | - |
 * | 13 | 数量限定値引 sales`/cart/barcode` | - |
 * | 14 | まとめ値引対象商品A sales`/cart/barcode` | - |
 * | 15 | まとめ値引対象商品B sales`/cart/barcode` | - |
 * | 16 | まとめ値引対象商品C sales`/cart/barcode` | - |
 * | 17 | 明細削除（まとめ値引対象商品B） sales`/cart/deleteitem` | - |
 * | 18 | 年齢確認商品 sales`/cart/barcode` | - |
 * | 19 | 年齢確認 sales`/age-verification` | - |
 * | 20 | ボーナスポイント対象商品 sales`/cart/barcode` | - |
 * | 21 | 株主優待 sales`/cart/barcode` | - |
 * | 22 | 小計 sales`/subtotal` | - |
 * | 23 | 現金支払 sales`/addpayment` | - |
 * | 24 | 取引完了 sales`/end` | - |
 * | 25 | 後片付け | - |
 * | - | 25.1 プリペのポイント付与のタイムアウトを戻す tmn-api-test`/set-api-timeout` | - |
 * 
 * ---
 * ### 前提条件
 * * 取引開始前にプリペのポイント付与を強制的に失敗させるように設定変更するAPIを呼ぶ
 * * こちらで機能実装
 * * https:`//atlassian.tm-nets.com/bitbucket/projects/THINPOSF/repos/eshopondaprnet6/pull-requests/6967/overview`
 * * 取引完了後に設定変更を元に戻すAPIを呼ぶ
 * 
 * ---
 * ### テストデータ
 * * 0.タイムアウト設定: 
 * *     endpoint: "`/tpi_v1/settlement/addpoint`",
 * *     timeout_milliseconds: 1
 * * 1. 会員登録: 8090227000000006, 操作シーン区分: 8
 * * 2. ポイント1倍商品: 4500000000110, 操作シーン区分: 2
 * * 3. ポイント3倍商品: 4500000000111 
 * * 4. ポイント対象外商品: 4911110703005
 * * 5. 通常商品: 1050000011001
 * * 6.  単品値引: [商品明細番号: 0 , 値引の種類: 売価指定, 値引率(額): 40]
 * * 7. 変更する売価: 50000
 * * 8. 超トク対象商品: 4500000000077
 * * 9. ポイント0倍商品: 4911111111012
 * * 10. 書籍: 9784799313282, 1921234010008
 * * 11. 数量限定値引: 4500000000056
 * * 12. まとめ値引対象商品A: 4500000000112
 * * 13. まとめ値引対象商品B: 4500000000113
 * * 14. まとめ値引対象商品C: 4500000000114
 * * 15. 年齢確認商品: 09450000000014820200
 * * 16. ボーナスポイント対象商品: 4520230413004
 * * 17. 株主優待: K20180900, 株主優待バーコード体系: Code39
 * * 18. 現金支払 : [支払グループコード: 0100, 支払コード: 0101, 支払額: 支払残額, 支払明細詳細情報: "]
 * * 19. レシートタイプ : 2
 * * 20.タイムアウト設定:  
 * *   endpoint: "`/tpi_v1/settlement/addpoint`",
 * *   timeout_milliseconds: -1
 * 
 * ---
 * ### 期待結果
 * * ※　実行結果と期待値が一致しない
 * * 以下の処理に間違いがあると思います。
 * * ms_sales.t_point_failure_tmn_prepaidテーブルにポイント付与（１）とポイント利用（３）のレコードがある
 * * ポイント付与（２）とポイント利用（３）が正しいと思います。
 * * #### '24. 取引完了 sales`/end`
 * * \- トランザクションデータは以下のテーブルに保存できたか確認する  (corporate_cd, store_cd, pos_cd, receipt_no と business_day フィールドで確認する)
 * * * \+ ms_sales.t_point_failre_tmn_prepaid
 * * * \+ ms_sales.t_point_failre_tmn_prepaid_plan
 * * * \+ ms_sales.t_point_failure
 * * * \+ ms_sales.t_voucher_issue_detail
 * * * \+ ms_pos_receipt.t_ejournal
 * * \- DBのデータを確認:
 * * * \+ ms_pos_receipt.t_ejournal.print_data に[翌日以降に反映されます。]の内容がある
 * * * \+ ms_pos_receipt.t_ejournal.print_data に [５００円  お買物券]の内容がある
 * * * \+ ms_sales.t_point_failre_tmn_prepaid テーブルに２つのレコードがある (receipt_no,business_dayで特定)
 * * * * \. レコード  : trade_type = 2 (ポイント付与)
 * * * * \. レコード  : trade_type = 3 (ポイント利用)
 * * * * \=> trade_number,trade_pos_cdフィールドの値を取る
 * * * \+ ms_sales.t_point_failureテーブルにて ２つのレコードがある
 * * (receipt_no, business_day, trade_number, trade_pos_cdフィールドで特定)
 * * * * \. レコード  : operation_kind = 1 (付与)
 * * * * \. レコード  : operation_kind = 3 (利用)
 */
export function TC_010258002_AwardPrepaidPointsForSalesFailed() {
  group("TC_010258002 売上_プリペポイント付与失敗", () => {
    const preStep = {
      generateKey: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      usePoint: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_USE_POINT),
    };

    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "会員登録"),
      barcodePointX1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント1倍商品"),
      barcodePointX3: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント3倍商品"),
      barcodeNonBonusPoint: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象外商品"),
      barcodeRegular2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品"),
      unitDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_UNIT_DISCOUNT),
      barcodeRegular2Second: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品 (2)"),
      changePrice: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE),
      barcodeSuperBargain: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "超トク対象商品"),
      barcodePointX0: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント0倍商品"),
      barcodeBookTwoTier: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "書籍"),
      barcodeLimitedQuantityDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "数量限定値引"),
      barcodeMixMatchDiscountA: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "まとめ値引対象商品A"),
      barcodeMixMatchDiscountB: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "まとめ値引対象商品B"),
      barcodeMixMatchDiscountC: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "まとめ値引対象商品C"),
      deleteItem: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_DELETE_ITEM, "明細削除（まとめ値引対象商品B）"),
      barcodeAgeRestricted: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "年齢確認商品"),
      ageVerification: CommonFunction.getFullDesc(ENDPOINT.SALES_AGE_VERIFICATION),
      barcodeBonusPoint: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ボーナスポイント対象商品"),
      barcodeShareholderBenefits: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      addPayment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      setTimeout: CommonFunction.getFullDesc(ENDPOINT.SET_API_TIMEOUT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      resetTimeout: CommonFunction.getFullDesc(ENDPOINT.SET_API_TIMEOUT, `${ENDPOINT.SET_API_TIMEOUT.desc} (reset)`),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA),
      getPosReceiptData: CommonFunction.getFullDesc(ENDPOINT.POS_RECEIPT_DATA_TRAN_GET_DATA),
      verifyTransactionsExist: "Verify Transactions Exist",
      verifyTransactionsValues: "Verify Transactions Values",
    };

    const operateEmployeeCd = "10000020";
    const tradeTypePointEarn = 2; // specified in master t_point_failure_tmn_prepaid (ポイント付与)
    const tradeTypePointUse = 3; // specified in master t_point_failure_tmn_prepaid (ポイント利用)
    const operationKindGrant = 1; // specified in master t_point_failure (付与)
    const operationKindUse = 3; // specified in master t_point_failure (利用)
    let salesEndResponse = null;

    // Run precondition to set Aok point equals 0 and set api timeout
    // 認証 /tpi_v1/terminal/generatekey
    TestHelper.tmnPrepaidCertification(preStep.generateKey, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 残高照会 /tpi_v1/holder/getbalance
    const point = TestHelper.tmnPrepaidGetBalance(preStep.getBalance, {
      cardNo: CARD.AOKI_PREPAID.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.point_count_sum;

    //// If point = 0, no need to run this API
    if (point > 0) {
      // ポイント利用 /tpi_v1/settlement/usepoint
      TestHelper.settlementUsePoint(preStep.usePoint, {
        cardNo: CARD.AOKI_PREPAID.CODE,
        receiptNo: ENVIRONMENT.TMN_PREPAID_RECEIPT_NO,
        usagePointCount: point,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    };

    // Main test case
    // 取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 会員登録 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeAokiPrepaid, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: 8,
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    // ポイント1倍商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodePointX1, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_X1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイント3倍商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodePointX3, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_X3,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイント対象外商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeNonBonusPoint, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NON_BONUS_POINT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 通常商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeRegular2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 単品値引 sales/cart/unitdiscount
    TestHelper.salesCartUnitDiscount(step.unitDiscount, {
      cartNo,
      discountType: "2",
      discountValue: 40,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 通常商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeRegular2Second, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 売価変更 sales/cart/changeitemprice
    TestHelper.salesCartChangeItemPrice(step.changePrice, {
      cartNo,
      statementNo: 0,
      updatedPrice: 50000,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 超トク対象商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeSuperBargain, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SUPER_BARGAIN,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイント0倍商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodePointX0, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_X0,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 書籍 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeBookTwoTier, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.BOOK_TWO_TIER_1,
          scan_data_type: "JAN13",
        },
        {
          barcode: PROD.BOOK_TWO_TIER_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 数量限定値引 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeLimitedQuantityDiscount, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.LIMITED_QUANTITY_DISCOUNT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // まとめ値引対象商品A sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeMixMatchDiscountA, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_DISCOUNT_A,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // まとめ値引対象商品B sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeMixMatchDiscountB, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_DISCOUNT_B,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // まとめ値引対象商品C sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeMixMatchDiscountC, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_DISCOUNT_C,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 明細削除（まとめ値引対象商品B） sales/cart/deleteitem
    TestHelper.salesCartDeleteItem(step.deleteItem, {
      cartNo,
      statementNo: 10,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 年齢確認商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeAgeRestricted, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.AGE_RESTRICTED,
          scan_data_type: "Code128",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 年齢確認 sales/age-verification
    TestHelper.salesAgeVerification(step.ageVerification, {
      cartNo,
      operateEmployeeCd,
      isVerified: true,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ボーナスポイント対象商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeBonusPoint, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.BONUS_POINT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 株主優待 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeShareholderBenefits, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.SHAREHOLDER_BENEFITS.CD,
          scan_data_type: "Code39",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 小計 sales/subtotal
    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    // 現金支払 sales/addpayment
    TestHelper.salesAddPayment(step.addPayment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
      totalBalanceAmount,
      details: "",
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
    try {
      // APIタイムアウト設定 /tmn-api-test/set-api-timeout
      TestHelper.setTMNServerApiTimeout(step.setTimeout, {
        endpoint: ENDPOINT.SETTLEMENT_ADD_POINT.path,
        timeoutMilliseconds: 1,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);

      // 取引完了 sales/end
      salesEndResponse = TestHelper.salesEnd(step.end, {
        cartNo,
        endDatetime: CommonFunction.getTimeNow(),
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    } finally {
      // APIタイムアウト設定 /tmn-api-test/set-api-timeout
      TestHelper.setTMNServerApiTimeout(step.resetTimeout, {
        endpoint: ENDPOINT.SETTLEMENT_ADD_POINT.path,
        timeoutMilliseconds: -1,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    }

    //3秒待機
    sleep(3);

    const businessDay = salesEndResponse.result?.business_day;
    const receiptNo = salesEndResponse.result?.receipt_no;

    const saleDataRes = TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const posReceiptDataRes = TestHelper.getPosReceiptData(step.getPosReceiptData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // Verify Transaction
    TestHelper.runGroupWithoutApi(step.verifyTransactionsExist, [
      {
        res: saleDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_point_failure_tmn_prepaid",
            expected: true,
            actual: (res) => res.result?.pointFailureTmnPrepaids?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_point_failure_tmn_prepaid_plan",
            expected: true,
            actual: (res) => res.result?.pointFailureTmnPrepaidPlans?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_point_failure",
            expected: true,
            actual: (res) => res.result?.pointFailures?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_voucher_issue_detail",
            expected: true,
            actual: (res) => res.result?.voucherIssueDetails?.length > 0,
          }),
        ],
      },
      {
        res: posReceiptDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_ejournal",
            expected: true,
            actual: (res) => res.result?.ejournals?.length > 0,
          }),
        ],
      },
    ]);

    // Verify Database Data
    TestHelper.runGroupWithoutApi(step.verifyTransactionsValues, [
      {
        res: posReceiptDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify ejournal print data contains 翌日以降に反映されます。",
            expected: true,
            actual: (res) => CommonFunction.includesItems([
              "翌日以降に反映されます。",
            ], res.result?.ejournals?.[res.result?.ejournals?.length - 1]?.printData),
          }),
          CHECK.createEqualsCheck({
            name: "Verify ejournal print data contains ５００円  お買物券",
            expected: true,
            actual: (res) => CommonFunction.includesItems([
              "５００円  お買物券",
            ], res.result?.ejournals?.[0]?.printData),
          }),
        ],
      },
      {
        res: saleDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify sales point failure tmnprepaid has 2 records matched ポイント与 and ポイント利用",
            expected: {
              tradeTypePointEarn,
              tradeTypePointUse,
            },
            actual: (res) => ({
              tradeTypePointEarn: res.result?.pointFailureTmnPrepaids?.[0]?.trade_type,
              tradeTypePointUse: res.result?.pointFailureTmnPrepaids?.[1]?.trade_type,
            }),
          }),
          CHECK.createEqualsCheck({
            name: "Verify sales point failure has 2 records matched 付与 and 利用",
            expected: {
              operationKindGrant,
              operationKindUse,
            },
            actual: (res) => {
              const tradeNumber = res.result?.pointFailureTmnPrepaids?.[0]?.trade_number;
              const tradePosCd = res.result?.pointFailureTmnPrepaids?.[0]?.trade_pos_cd;
              const actualData = res.result?.pointFailures?.filter(q => q.tradeNumber === tradeNumber && q.tradePosCd === tradePosCd);
              return {
                operationKindGrant: actualData?.[0]?.operationKind,
                operationKindUse: actualData?.[1]?.operationKind,
              };
            },
          }),
        ],
      },
    ]);
  });
}

/**
 * @function 売上_領収額_税計算
 * @memberof 売上点検.取引別レポート
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES_INSPECTION}
 * {@link TAGS.SALES}
 * {@link TAGS.REPORT_BY_TRANSACTION}
 * {@link TAGS.TAX_CALCULATION}
 * {@link TAGS.JOURNAL_SAVE}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.COMPANY_DISCOUNT}
 * ### テスト観点
 * * 併用支払を行う
 * * * ・社割・その他値引券は領収証金額対象外 かつ ポイント対象区分：税額
 * * * ・税率8%, 10%, 非課税の商品登録を行う
 * * ーーー
 * * 支払トラン
 * * * ・支払額
 * * * ・おつり額
 * * * ・支払トラン自由項目
 * * 売上_税トラン
 * * * ・税コード
 * * * ・課税対象額
 * * * ・税額
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 |  取引開始 sales`/begin` | - |
 * | 2 | 外税8%商品 sales`/cart/barcode` | - |
 * | 3 | 内税8%商品 sales`/cart/barcode` | - |
 * | 4 |  外税10%商品 sales`/cart/barcode` | - |
 * | 5 | 内税10%商品 sales`/cart/barcode` | - |
 * | 6 | 非課税商品 sales`/cart/barcode` | - |
 * | 7 | 社割登録 sales`/cart/barcode` | - |
 * | 8 | 小計 sales`/subtotal` | - |
 * | 9 | 金券利用（その他値引券） sales`/cart/voucher` | - |
 * | 10 | 現金支払 sales`/addpayment` | - |
 * | 11 | 取引完了 sales`/end` | - |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 外税8%商品: 1050000011001, 操作シーン区分: 2
 * * 2. 内税8%商品: 4500000000070
 * * 3. 外税10%商品: 4520230413003
 * * 4. 内税10%商品: 4520230413004
 * * 5. 非課税商品: 4500000000087
 * * 6. 社割登録 : S01000020W
 * * 7. 金券利用（その他値引券 ） : [金券コード : 0602, 支払額 : 1000]
 * * 8. 現金支払[支払グループコード: 0100, 支払コード: 0101, 支払額: 支払残額, 支払明細詳細情報: "]
 * * 9. レシートタイプ:2
 * 
 * ---
 * ### 期待結果
 * * ※　実行結果と期待値が一致しない
 * * 以下の処理に間違いがあると思います。
 * * 支払トラン自由項目
 * * #### 11. 取引完了 sales`/end`
 * * \- トランザクションデータは以下のテーブルに保存できたか確認する (store_cd, pos_cd, response.receipt_noと response.business_dayで特定)
 * * * \+ ms-sales.t_payment
 * * * \+ ms_sales.t_payment_voucher
 * * * \+ ms-sales.t_payment_cash
 * * * \+ ms-sales.t_cash_flow
 * * * \+ ms-pos-receipt.t_ejournal_payment
 * * * \+ ms-pos-receipt.t_ejournal_payment_detail
 * * \- DBのデータを確認する
 * * * \+ ms_sales.t_payment.paid_amount に以下の３つのレコードがある
 * * * * \. 社割登録 = ５つ商品の合計金額 × (Voucher Master.Discount Rate ÷ 100) = (1000+108+150+150+1000)×(5÷100) = 121 (※120.4 切り上げ)
 * * * * \. 金券利用（その他値引券） :  1000
 * * * * \. 現金支払: ５つ商品の合計金額（税込） - 社割登録 - 金券利用（その他値引券） = 1000+(1000×8÷100)+108+150+(150×10÷100)+150+1000-121-1000 = 1382
 * * * \+ ms_sales.t_payment.change_amount は以下の３つのレコードがある
 * * * * \. 社割登録 : 0
 * * * * \. 金券利用（その他値引券） : 0
 * * * * \. 現金支払 : 0
 * * * \+ ms_sales.t_payment.payment_free_area は以下の３つのレコードがある
 * * * * \. 社割登録 : 10%対象金額`/8`%対象金額/非課税対象金額 = 300`/1108/1000`
 * * * * \.. 10%対象金額 = 外税10%商品.display_unit_price + 内税10%商品.display_unit_price = 150 + 150 = 300
 * * * * \.. 8%対象金額 =  外税8%商品.display_unit_price + 内税8%商品.display_unit_price = 1000+ 108 = 1108
 * * * * \.. 非課税対象金額 = 非課税商品.display_unit_price = 1000
 * * * * \. 金券利用（その他値引券） : "
 * * * * \. 現金支払 : "
 * * * \+ ms_sales.t_sales_detail_tax.tax_cd は以下の５つのレコードがある
 * * * * \. 外税8%商品 : 01
 * * * * \. 内税8%商品 : 02
 * * * * \. 外税10%商品 : 03
 * * * * \. 内税10%商品: 04
 * * * * \. 非課税商品 : 05
 * * * \+ ms_sales.t_sales_detail_tax.taxable_amount は５つのレコードがある。各レコードが商品のDisplay unit priceです
 * * * * \. 外税8%商品 : 外税8%商品.display_unit_price = 1000
 * * * * \. 内税8%商品 : 内税8%商品.display_unit_price = 108
 * * * * \. 外税10%商品 : 外税10%商品.display_unit_price = 150
 * * * * \. 内税10%商品: 内税10%商品.display_unit_price = 150
 * * * * \. 非課税商品 : 非課税商品.display_unit_price = 1000
 * * * \+ ms_sales.t_sales_detail_tax.tax_amount  は５つのレコードがある。各レコードが商品の税金です。
 * * * * \. 外税8%商品 : calcTaxAmount(外税8%商品) = 80
 * * * * \. 内税8%商品 : calcTaxAmount(内税8%商品) = 8
 * * * * \. 外税10%商品 : calcTaxAmount(外税10%商品) = 15
 * * * * \. 内税10%商品: calcTaxAmount(内税10%商品) = 13
 * * * * \. 非課税商品 : 0
 */
export function TC_010258003_SalesReceiptAmountWithTax() {
  group("TC_010258003 売上_領収額_税計算", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeTaxExcluded8: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "外税8%商品"),
      barcodeTaxIncluded8: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "内税8%商品"),
      barcodeTaxExcluded10: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "外税10%商品"),
      barcodeTaxIncluded10: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "内税10%商品"),
      barcodeNonTax: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "非課税商品"),
      barcodeEmployeeDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割登録"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      voucher: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_VOUCHER, "金券利用（その他値引券）"),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA),
      getPosReceiptData: CommonFunction.getFullDesc(ENDPOINT.POS_RECEIPT_DATA_TRAN_GET_DATA),
      verifyTransactionsExist: "Verify Transactions Exist",
      verifyTransactionsValues: "Verify Transactions Values",
    };

    // 社割登録
    const changeAmountEmployeeDiscount = 0;
    // 金券利用（その他値引券）
    const changeAmountOtherDiscount = 0;
    // 現金支払
    const changeAmountCash = 0;

    // 取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 外税8%商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeTaxExcluded8, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.TAX_EXCLUDED_8,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 内税8%商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeTaxIncluded8, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.TAX_INCLUDED_8,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 外税10%商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeTaxExcluded10, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.TAX_EXCLUDED_10,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 内税10%商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeTaxIncluded10, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.TAX_INCLUDED_10,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 非課税商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeNonTax, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NON_TAX,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 社割登録 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscount, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.EMPLOYEE_DISCOUNT.CD,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 小計 sales/subtotal
    const items = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.items;

    const taxExcluded8 = items?.[0];
    const taxIncluded8 = items?.[1];
    const taxExcluded10 = items?.[2];
    const taxIncluded10 = items?.[3];
    const nonTax = items?.[4];

    // 金券利用（その他値引券）sales/cart/voucher
    const otherDiscountAmount = 1000;
    const totalBalanceAmount = TestHelper.salesCartVoucher(step.voucher, {
      cartNo,
      voucherCode: COUPON.OTHER_DISCOUNT.CD,
      voucherBalanceAmount: otherDiscountAmount,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    // 現金支払 sales/addpayment
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      totalBalanceAmount,
      details: "",
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 取引完了 sales/end
    const salesEndResponse = TestHelper.salesEnd(
      step.end,
      {
        cartNo,
        endDatetime: CommonFunction.getTimeNow(),
      },
      [
        CHECK.createStatusCodeCheck(),
      ],
    );

    sleep(5);

    const receiptNo = salesEndResponse?.result?.receipt_no;
    const businessDay = salesEndResponse?.result?.business_day;

    // 10%対象金額
    const displayPriceTax10 = taxExcluded10.display_unit_price + taxIncluded10.display_unit_price;
    // 8%対象金額
    const displayPriceTax8 = taxExcluded8.display_unit_price + taxIncluded8.display_unit_price;
    const totalDisplayPrice = displayPriceTax8 + displayPriceTax10 + nonTax.display_unit_price;
    // 社割登録
    const totalPriceAfterEmployeeDiscount = Math.ceil(totalDisplayPrice * (COUPON.EMPLOYEE_DISCOUNT.DISCOUNT_RATE / 100));
    const taxExcluded8AfterTax = Formular.calcPriceAfterTax(taxExcluded8);
    const taxExcluded10AfterTax = Formular.calcPriceAfterTax(taxExcluded10);
    // 現金支払
    const totalPriceAfterTax = taxExcluded8AfterTax + taxIncluded8.unit_price + taxExcluded10AfterTax + taxIncluded10.unit_price + nonTax.unit_price;

    // Salesdata を取得
    const salesDataRes = TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // PosReceiptData を取得
    const posReceiptDataRes = TestHelper.getPosReceiptData(
      step.getPosReceiptData,
      {
        storeCd: ENVIRONMENT.STORE_CD,
        posCd: ENVIRONMENT.POS_CD,
        businessDay,
        receiptNo,
      },
      [
        CHECK.createStatusCodeCheck(),
      ],
    );

    TestHelper.runGroupWithoutApi(step.verifyTransactionsExist, [
      {
        res: salesDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_payment",
            expected: true,
            actual: (res) => res.result?.payments?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_payment_voucher",
            expected: true,
            actual: (res) => res.result?.paymentVouchers?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_payment_cash",
            expected: true,
            actual: (res) => res.result?.paymentCashes?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_cash_flow",
            expected: true,
            actual: (res) => res.result?.cashFlows?.length > 0,
          }),
        ],
      },
      {
        res: posReceiptDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_ejournal_payment",
            expected: true,
            actual: (res) => res.result?.ejournalPayments?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_ejournal_payment_detail",
            expected: true,
            actual: (res) => res.result?.ejournalPaymentDetails?.length > 0,
          }),
        ],
      },
    ]);

    TestHelper.runGroupWithoutApi(step.verifyTransactionsValues, [
      {
        res: salesDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data: 支払額",
            expected: {
              FirstData: totalPriceAfterEmployeeDiscount,
              SecondData: otherDiscountAmount,
              ThirdData: totalPriceAfterTax - totalPriceAfterEmployeeDiscount - otherDiscountAmount,
            },
            actual: (res) => {
              return {
                FirstData: res.result?.payments?.[0]?.paidAmount,
                SecondData: res.result?.payments?.[1]?.paidAmount,
                ThirdData: res.result?.payments?.[2]?.paidAmount,
              };
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: おつり額",
            expected: {
              FirstData: changeAmountEmployeeDiscount,
              SecondData: changeAmountOtherDiscount,
              ThirdData: changeAmountCash,
            },
            actual: (res) => {
              return {
                FirstData: res.result?.payments?.[0]?.changeAmount,
                SecondData: res.result?.payments?.[1]?.changeAmount,
                ThirdData: res.result?.payments?.[2]?.changeAmount,
              };
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: 支払トラン自由項目",
            expected: {
              FirstData: displayPriceTax10 + "/" + displayPriceTax8 + "/" + otherDiscountAmount,
              SecondData: "",
              ThirdData: "",
            },
            actual: (res) => {
              return {
                FirstData: res.result?.payments?.[0]?.paymentFreeArea,
                SecondData: res.result?.payments?.[1]?.paymentFreeArea,
                ThirdData: res.result?.payments?.[2]?.paymentFreeArea,
              };
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: 税コード",
            expected: {
              FirstData: TAX.EXCLUDED8.CD,
              SecondData: TAX.INCLUDED8.CD,
              ThirdData: TAX.EXCLUDED10.CD,
              FourthData: TAX.INCLUDED10.CD,
              FifthData: TAX.NONTAX.CD,
            },
            actual: (res) => {
              return {
                FirstData: res.result?.salesDetailTaxes?.[0]?.taxCd,
                SecondData: res.result?.salesDetailTaxes?.[1]?.taxCd,
                ThirdData: res.result?.salesDetailTaxes?.[2]?.taxCd,
                FourthData: res.result?.salesDetailTaxes?.[3]?.taxCd,
                FifthData: res.result?.salesDetailTaxes?.[4]?.taxCd,
              };
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: 課税対象額",
            expected: {
              FirstData: taxExcluded8.display_unit_price,
              SecondData: taxIncluded8.display_unit_price,
              ThirdData: taxExcluded10.display_unit_price,
              FourthData: taxIncluded10.display_unit_price,
              FifthData: nonTax.display_unit_price,
            },
            actual: (res) => {
              return {
                FirstData: res.result?.salesDetailTaxes?.[0]?.taxableAmount,
                SecondData: res.result?.salesDetailTaxes?.[1]?.taxableAmount,
                ThirdData: res.result?.salesDetailTaxes?.[2]?.taxableAmount,
                FourthData: res.result?.salesDetailTaxes?.[3]?.taxableAmount,
                FifthData: res.result?.salesDetailTaxes?.[4]?.taxableAmount,
              };
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: 税額",
            expected: {
              FirstData: Formular.calcTaxAmount(taxExcluded8),
              SecondData: Formular.calcTaxAmount(taxIncluded8),
              ThirdData: Formular.calcTaxAmount(taxExcluded10),
              FourthData: Formular.calcTaxAmount(taxIncluded10),
              FifthData: Formular.calcTaxAmount(nonTax),
            },
            actual: (res) => {
              return {
                FirstData: res.result?.salesDetailTaxes?.[0]?.taxAmount,
                SecondData: res.result?.salesDetailTaxes?.[1]?.taxAmount,
                ThirdData: res.result?.salesDetailTaxes?.[2]?.taxAmount,
                FourthData: res.result?.salesDetailTaxes?.[3]?.taxAmount,
                FifthData: res.result?.salesDetailTaxes?.[4]?.taxAmount,
              };
            },
          }),
        ],
      },
    ]);
  });
}

/**
 * @function 誤打訂正
 * @memberof 売上点検.取引別レポート
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES_INSPECTION}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.REPORT_BY_TRANSACTION}
 * {@link TAGS.JOURNAL_SAVE}
 * {@link TAGS.AGE_CONFIRMATION_PRODUCT}
 * {@link TAGS.SELLING_PRICE_CHANGE}
 * {@link TAGS.DELETE_DETAILS}
 * ### テスト観点
 * * 誤打訂正トラン
 * * 元取引の売上トラン
 * * * ・取引取消済フラグ
 * * 新取引の売上トラン：以下項目が元取引の売上トランの値 × (-1)
 * * * ・合計数量
 * * * ・合計値引額
 * * * ・合計値引数量
 * * * ・合計売上額
 * * * ・免税対象額
 * * * ・合計税対象金額
 * * * ・合計税額
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 |  取引開始 sales`/begin` | - |
 * | 2 | 会員登録 sales`/cart/barcode` | - |
 * | 3 | ポイント1倍商品 sales`/cart/barcode` | - |
 * | 4 |  ポイント3倍商品 sales`/cart/barcode` | - |
 * | 5 | ポイント対象外商品 sales`/cart/barcode` | - |
 * | 6 | 通常商品 sales`/cart/barcode` | - |
 * | 7 | 単品値引 sales`/cart/unitdiscount` | - |
 * | 8 | 通常商品 sales`/cart/barcode` | - |
 * | 9 | 売価変更 sales`/cart/changeitemprice` | - |
 * | 10 | 超トク対象商品 sales`/cart/barcode` | - |
 * | 11 | ポイント0倍商品 sales`/cart/barcode` | - |
 * | 12 | 書籍 sales`/cart/barcode` | - |
 * | 13 | 数量限定値引 sales`/cart/barcode` | - |
 * | 14 | まとめ値引対象商品A sales`/cart/barcode` | - |
 * | 15 | まとめ値引対象商品B sales`/cart/barcode` | - |
 * | 16 | まとめ値引対象商品C sales`/cart/barcode` | - |
 * | 17 | 明細削除（まとめ値引対象商品B） sales`/cart/deleteitem` | - |
 * | 18 | 年齢確認商品 sales`/cart/barcode` | - |
 * | 19 | 年齢確認 sales`/age-verification` | - |
 * | 20 | ボーナスポイント対象商品 sales`/cart/barcode` | - |
 * | 21 | 株主優待 sales`/cart/barcode` | - |
 * | 22 | 小計 sales`/subtotal` | - |
 * | 23 | 現金支払 sales`/addpayment` | - |
 * | 24 | 取引完了 sales`/end` | - |
 * | 25 | 【誤打訂正】取引開始 void`/begin` | - |
 * | 26 | 【誤打訂正】支払登録 void`/addpayment` | - |
 * | 27 | 【誤打訂正】取引完了 void`/end` | - |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 会員登録: 8090227000000006, 操作シーン区分: 8
 * * 2. ポイント1倍商品: 4500000000110, 操作シーン区分: 2
 * * 3. ポイント3倍商品: 4500000000111 
 * * 4. ポイント対象外商品: 4911110703005
 * * 5. 通常商品: 1050000011001
 * * 6.  単品値引: [商品明細番号: 0 , 値引の種類: 売価指定, 値引率(額): 40]
 * * 7. 変更する売価: 50000
 * * 8. 超トク対象商品: 4500000000077
 * * 9. ポイント0倍商品: 4911111111012
 * * 10. 書籍: 9784799313282, 1921234010008
 * * 11. 数量限定値引: 4500000000056
 * * 12. まとめ値引対象商品A: 4500000000112
 * * 13. まとめ値引対象商品B: 4500000000113
 * * 14. まとめ値引対象商品C: 4500000000114
 * * 15. 年齢確認商品: 09450000000014820200
 * * 16. ボーナスポイント対象商品: 4520230413004
 * * 17. 株主優待: K20180900, 株主優待バーコード体系: Code39
 * * 18. 現金支払 : [支払グループコード: 0100, 支払コード: 0101, 支払額: 支払残額, 支払明細詳細情報: "]
 * * 19. レシートタイプ : 2
 * 
 * ---
 * ### 期待結果
 * * #### 24. sales`/end`
 * * sale_receipt_no = receipts.receipt_no
 * * #### 27. void`/end`
 * * void_receipt_no = receipts.receipt_no
 * * ーーー
 * * \- トランザクションデータは以下のテーブルに保存できたか確認する (void_receip_noで特定):
 * * * \+ms-sales.t_sales  に２つのレコードがある (sale_receipt_no, void_receipt_noで特定)
 * * * \+ms-sales.t_void_sales に１つのレコードがある(void_receipt_noで特定)
 * * \- DBのデータを確認:
 * * t_sales テーブルを確認 (sale_receip_no で特定):
 * * * \+ ms-sales.t_sales.cancelled_flg = 1(取引取消済)
 * * t_salesにレコードがあり (sale_receipt_noで特定)
 * * * \+ source.total_quantity  = ms-sales.t_sales.total_quantity
 * * * \+ source.total_discount_amount   =  ms-sales.t_sales.total_discount_amount
 * * * \+ source.total_discount_quantity  = ms-sales.t_sales.total_discount_quantity
 * * * \+ source.total_sales_amount= ms-sales.t_sales.total_sales_amount,
 * * * \+ source.tax_exemption_amount  = ms-sales.t_sales.tax_exemption_amount
 * * * \+ source.total_taxable_amount= ms-sales.t_sales.total_taxable_amount,
 * * * \+ source.total_tax_amount= ms-sales.t_sales.total_tax_amount
 * * t_salesでレコードがある (void_receip_noで特定):
 * * * \+ ms-sales.t_sales.total_quantity = - source.total_quantity
 * * * \+ ms-sales.t_sales.total_discount_amount = -source.total_discount_amount
 * * * \+ ms-sales.t_sales.total_discount_quantity = -source.total_discount_quantity
 * * * \+ ms-sales.t_sales.total_sales_amount = -source.total_sales_amount
 * * * \+ ms-sales.t_sales.tax_exemption_amount  = -source.tax_exemption_amount
 * * * \+ ms-sales.t_sales.total_taxable_amount = -source.total_taxable_amount
 * * * \+ ms-sales.t_sales.total_tax_amount = -source.total_tax_amount
 */
export function TC_040258001_Void() {
  group("TC_040258001 誤打訂正", () => {
    const step = {
      salesBegin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrePaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "会員登録"),
      barcodePointX1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント1倍商品"),
      barcodePointX3: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント3倍商品"),
      barcodeNonBonusPoint: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象外商品"),
      barcodeRegular2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品"),
      unitDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_UNIT_DISCOUNT),
      barcodeRegular2Second: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品 (2)"),
      changePrice: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE),
      barcodeSuperBargain: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "超トク対象商品"),
      barcodePointX0: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント0倍商品"),
      barcodeBookTwoTier: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "書籍"),
      barcodeLimitedQuantityDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "数量限定値引"),
      barcodeMixMatchDiscountA: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "まとめ値引対象商品A"),
      barcodeMixMatchDiscountB: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "まとめ値引対象商品B"),
      barcodeMixMatchDiscountC: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "まとめ値引対象商品C"),
      deleteItem: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_DELETE_ITEM, "明細削除（まとめ値引対象商品B）"),
      barcodeAgeRestricted: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "年齢確認商品"),
      ageVerification: CommonFunction.getFullDesc(ENDPOINT.SALES_AGE_VERIFICATION),
      barcodeBonusPoint: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ボーナスポイント対象商品"),
      barcodeShareholderBenefits: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待"),
      salesSubtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      salesPayment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      salesEnd: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      voidPayment: CommonFunction.getFullDesc(ENDPOINT.VOID_PAYMENT),
      voidEnd: CommonFunction.getFullDesc(ENDPOINT.VOID_END),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA),
      getVoidData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA, `${ENDPOINT.SALES_DATA_TRAN_GET_DATA.desc}【誤打訂正】`),
      verifyTransactionsExist: "Verify Transactions Exist",
      verifyTransactionsValues: "Verify Transactios Values",
    };

    const operateEmployeeCd = "10000020"; // test data

    // 取引開始 /sales/begin
    let cartNo = TestHelper.salesBegin(step.salesBegin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 会員登録 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeAokiPrePaid, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: 8,
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    // ポイント1倍商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodePointX1, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_X1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイント3倍商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodePointX3, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_X3,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイント対象外商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeNonBonusPoint, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NON_BONUS_POINT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 通常商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeRegular2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 単品値引 sales/cart/unitdiscount
    TestHelper.salesCartUnitDiscount(step.unitDiscount, {
      cartNo,
      statementNo: 0,
      discountType: "2",
      discountValue: 40,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 通常商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeRegular2Second, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 売価変更 sales/cart/changeitemprice
    TestHelper.salesCartChangeItemPrice(step.changePrice, {
      cartNo,
      statementNo: 0,
      updatedPrice: 50000,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 超トク対象商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeSuperBargain, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SUPER_BARGAIN,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイント0倍商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodePointX0, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_X0,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 書籍 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeBookTwoTier, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.BOOK_TWO_TIER_1,
          scan_data_type: "JAN13",
        },
        {
          barcode: PROD.BOOK_TWO_TIER_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 数量限定値引 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeLimitedQuantityDiscount, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.LIMITED_QUANTITY_DISCOUNT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // まとめ値引対象商品A sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeMixMatchDiscountA, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_DISCOUNT_A,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // まとめ値引対象商品B sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeMixMatchDiscountB, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_DISCOUNT_B,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // まとめ値引対象商品C sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeMixMatchDiscountC, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_DISCOUNT_C,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 明細削除（まとめ値引対象商品B） sales/cart/deleteitem
    TestHelper.salesCartDeleteItem(step.deleteItem, {
      cartNo,
      statementNo: 10,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 年齢確認商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeAgeRestricted, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.AGE_RESTRICTED,
          scan_data_type: "Code128",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 年齢確認 sales/age-verification
    TestHelper.salesAgeVerification(step.ageVerification, {
      cartNo,
      operateEmployeeCd,
      isVerified: true,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ボーナスポイント対象商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeBonusPoint, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.BONUS_POINT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 株主優待 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeShareholderBenefits, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.SHAREHOLDER_BENEFITS.CD,
          scan_data_type: "Code39",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 小計 sales/subtotal
    let totalBalanceAmount = TestHelper.salesSubtotal(step.salesSubtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    // 現金支払 sales/addpayment
    TestHelper.salesAddPayment(step.salesPayment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      totalBalanceAmount,
      details: "",
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 取引完了 sales/end
    const salesEndResponse = TestHelper.salesEnd(step.salesEnd, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    sleep(5);

    // 【誤打訂正】取引開始 void/begin
    const voidCartInfo = TestHelper.voidBegin(step.voidBegin, {
      receiptBarcode,
      operateEmployeeCd,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = voidCartInfo?.cart_no;
    const payment = voidCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE);

    // 【誤打訂正】支払登録 void/addpayment
    TestHelper.voidPayment(step.voidPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: payment?.paid_amount,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 【誤打訂正】取引完了 void/end
    const voidEndResponse = TestHelper.voidEnd(step.voidEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const voidReceiptNo = voidEndResponse.result?.receipt_no;
    const voidBusinessDay = voidEndResponse.result?.business_day;

    //3秒待機
    sleep(3);

    // Verify sales data
    const salesData = TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay: salesBusinessDay,
      receiptNo: salesReceiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // Verify void data
    const voidData = TestHelper.getSalesData(step.getVoidData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay: voidBusinessDay,
      receiptNo: voidReceiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.runGroupWithoutApi(step.verifyTransactionsExist, [
      {
        res: voidData,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify t_sales data has 2 record",
            expected: true,
            actual: (res) => res.result?.sales?.length === 2,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_void_sales",
            expected: true,
            actual: (res) => res.result?.voidSales?.length > 0,
          }),
        ],
      },
    ]);

    TestHelper.runGroupWithoutApi(step.verifyTransactionsValues, [
      {
        res: salesData,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data t_sales by sale receipt no: transaction is cancelled",
            expected: true,
            actual: (res) => res.result?.sales?.some(s => s.cancelledFlg === true && s.receiptNo === salesReceiptNo),
          }),
        ],
      },
      {
        res: voidData,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data t_sales by void receipt no: 以下項目が元取引の売上トランの値 × (-1)",
            expected: true,
            actual: (res) => {
              const voidData = res.result?.sales.filter(r => r.receiptNo === voidReceiptNo);
              let result = true;
              result = voidData.length === 1 && salesData?.result?.sales?.length === 1;
              if (!result) return result;
              const voidItem = voidData?.[0];
              const salesItem = salesData.result?.sales?.[0];
              result = result && (voidItem?.totalQuantity === -salesItem?.totalQuantity);
              result = result && (voidItem?.totalDiscountAmount === -salesItem?.totalDiscountAmount);
              result = result && (voidItem?.totalDiscountQuantity === -salesItem?.totalDiscountQuantity);
              result = result && (voidItem?.totalSalesAmount === -salesItem?.totalSalesAmount);
              result = result && (voidItem?.taxExemptionAmount === -salesItem?.taxExemptionAmount);
              result = result && (voidItem?.totalTaxableAmount === -salesItem?.totalTaxableAmount);
              result = result && (voidItem?.totalTaxAmount === -salesItem?.totalTaxAmount);
              return result;
            },
          }),
        ],
      },
    ]);
  });
}

/**
 * @function 返品
 * @memberof 売上点検.取引別レポート
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES_INSPECTION}
 * {@link TAGS.RETURN}
 * {@link TAGS.REPORT_BY_TRANSACTION}
 * {@link TAGS.JOURNAL_SAVE}
 * {@link TAGS.AGE_CONFIRMATION_PRODUCT}
 * {@link TAGS.SELLING_PRICE_CHANGE}
 * {@link TAGS.DELETE_DETAILS}
 * ### テスト観点
 * * 返品トラン
 * * 元取引の売上トラン
 * * * ・返品済フラグ
 * * 新取引の売上トラン：以下項目が元取引の売上トランの値 × (-1)
 * * * ・合計数量
 * * * ・合計値引額
 * * * ・合計値引数量
 * * * ・合計売上額
 * * * ・免税対象額
 * * * ・合計税対象金額
 * * * ・合計税額
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 |  取引開始 sales`/begin` | - |
 * | 2 | 会員登録 sales`/cart/barcode` | - |
 * | 3 | ポイント1倍商品 sales`/cart/barcode` | - |
 * | 4 |  ポイント3倍商品 sales`/cart/barcode` | - |
 * | 5 | ポイント対象外商品 sales`/cart/barcode` | - |
 * | 6 | 通常商品 sales`/cart/barcode` | - |
 * | 7 | 単品値引 sales`/cart/unitdiscount` | - |
 * | 8 | 通常商品 sales`/cart/barcode` | - |
 * | 9 | 売価変更 sales`/cart/changeitemprice` | - |
 * | 10 | 超トク対象商品 sales`/cart/barcode` | - |
 * | 11 | ポイント0倍商品 sales`/cart/barcode` | - |
 * | 12 | 書籍 sales`/cart/barcode` | - |
 * | 13 | 数量限定値引 sales`/cart/barcode` | - |
 * | 14 | まとめ値引対象商品A sales`/cart/barcode` | - |
 * | 15 | まとめ値引対象商品B sales`/cart/barcode` | - |
 * | 16 | まとめ値引対象商品C sales`/cart/barcode` | - |
 * | 17 | 明細削除（まとめ値引対象商品B） sales`/cart/deleteitem` | - |
 * | 18 | 年齢確認商品 sales`/cart/barcode` | - |
 * | 19 | 年齢確認 sales`/age-verification` | - |
 * | 20 | ボーナスポイント対象商品 sales`/cart/barcode` | - |
 * | 21 | 株主優待 sales`/cart/barcode` | - |
 * | 22 | 小計 sales`/subtotal` | - |
 * | 23 | 現金支払 sales`/addpayment` | - |
 * | 24 | 取引完了 sales`/end` | - |
 * | 25 | 【返品】取引開始 refund`/begin` | - |
 * | 26 | 【返品】小計 refund`/subtotal` | - |
 * | 27 | 【返品】支払登録 refund`/addpayment` | - |
 * | - | 28. 【返品】取引完了 refund`/end` | - |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 会員登録: 8090227000000006, 操作シーン区分: 8
 * * 2. ポイント1倍商品: 4500000000110, 操作シーン区分: 2
 * * 3. ポイント3倍商品: 4500000000111 
 * * 4. ポイント対象外商品: 4911110703005
 * * 5. 通常商品: 1050000011001
 * * 6.  単品値引: [商品明細番号: 0 , 値引の種類: 売価指定, 値引率(額): 40]
 * * 7. 変更する売価: 50000
 * * 8. 超トク対象商品: 4500000000077
 * * 9. ポイント0倍商品: 4911111111012
 * * 10. 書籍: 9784799313282, 1921234010008
 * * 11. 数量限定値引: 4500000000056
 * * 12. まとめ値引対象商品A: 4500000000112
 * * 13. まとめ値引対象商品B: 4500000000113
 * * 14. まとめ値引対象商品C: 4500000000114
 * * 15. 年齢確認商品: 09450000000014820200
 * * 16. ボーナスポイント対象商品: 4520230413004
 * * 17. 株主優待: K20180900, 株主優待バーコード体系: Code39
 * * 18. 現金支払 : [支払グループコード: 0100, 支払コード: 0101, 支払額: 支払残額, 支払明細詳細情報: "]
 * * 19. レシートタイプ : 2
 * 
 * ---
 * ### 期待結果
 * * #### 24. sales`/end`
 * * sale_receip_no = receipts.receipt_no
 * * #### 28. refund`/end`
 * * refund_receip_no = receipts.receipt_no
 * * ーーー
 * * \- トランザクションデータは以下のテーブルに保存できたか確認する (refund_receipt_noで特定):
 * * * \+ms-sales.t_sales
 * * * \+ms-sales.t_refund_sales
 * * \- DBのデータを確認:
 * * t_salesテーブルで確認する (sale_receipt_noで特定):
 * * * \+ ms-sales.t_sales.returned_flg= 1  (sale_receipt_noで特定)
 * * t_salesのレコードを確認 (sale_receipt_noで特定)
 * * * \+ source.total_quantity  = ms-sales.t_sales.total_quantity
 * * * \+ source.total_discount_amount   =  ms-sales.t_sales.total_discount_amount
 * * * \+ source.total_discount_quantity  = ms-sales.t_sales.total_discount_quantity
 * * * \+ source.total_sales_amount= ms-sales.t_sales.total_sales_amount,
 * * * \+ source.tax_exemption_amount  = ms-sales.t_sales.tax_exemption_amount
 * * * \+ source.total_taxable_amount= ms-sales.t_sales.total_taxable_amount,
 * * * \+ source.total_tax_amount= ms-sales.t_sales.total_tax_amount
 * * t_salesテーブルで確認する (refund_receip_noで特定):
 * * * \+ ms-sales.t_sales.total_quantity = - source.total_quantity
 * * * \+ ms-sales.t_sales.total_discount_amount = -source.total_discount_amount
 * * * \+ ms-sales.t_sales.total_discount_quantity = -source.total_discount_quantity
 * * * \+ ms-sales.t_sales.total_sales_amount = -source.total_sales_amount
 * * * \+ ms-sales.t_sales.tax_exemption_amount  = -source.tax_exemption_amount
 * * * \+ ms-sales.t_sales.total_taxable_amount = -source.total_taxable_amount
 * * * \+ ms-sales.t_sales.total_tax_amount = -source.total_tax_amount
 */
export function TC_021258001_Refunds() {
  group("TC_021258001 返品", () => {
    const step = {
      salesBegin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrePaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "会員登録"),
      barcodePointX1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント1倍商品"),
      barcodePointX3: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント3倍商品"),
      barcodeNonBonusPoint: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象外商品"),
      barcodeRegular2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品"),
      unitDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_UNIT_DISCOUNT),
      barcodeRegular2Second: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品 (2)"),
      changePrice: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE),
      barcodeSuperBargain: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "超トク対象商品"),
      barcodePointX0: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント0倍商品"),
      barcodeBookTwoTier: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "書籍"),
      barcodeLimitedQuantityDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "数量限定値引"),
      barcodeMixMatchDiscountA: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "まとめ値引対象商品A"),
      barcodeMixMatchDiscountB: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "まとめ値引対象商品B"),
      barcodeMixMatchDiscountC: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "まとめ値引対象商品C"),
      deleteItem: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_DELETE_ITEM, "明細削除（まとめ値引対象商品B）"),
      barcodeAgeRestricted: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "年齢確認商品"),
      ageVerification: CommonFunction.getFullDesc(ENDPOINT.SALES_AGE_VERIFICATION),
      barcodeBonusPoint: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ボーナスポイント対象商品"),
      barcodeShareholderBenefits: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待"),
      salesSubtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      salesPayment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      salesEnd: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA),
      getRefundData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA, `${ENDPOINT.SALES_DATA_TRAN_GET_DATA.desc} 【返品】`),
      verifyTransactionsExist: "Verify Transactions Exist",
      verifyTransactionsValues: "Verify Transactions Values",
    };

    const operateEmployeeCd = "10000020"; // test data

    // 取引開始 /sales/begin
    let cartNo = TestHelper.salesBegin(step.salesBegin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 会員登録 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeAokiPrePaid, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: 8,
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    // ポイント1倍商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodePointX1, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_X1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイント3倍商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodePointX3, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_X3,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイント対象外商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeNonBonusPoint, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NON_BONUS_POINT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 通常商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeRegular2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 単品値引 sales/cart/unitdiscount
    TestHelper.salesCartUnitDiscount(step.unitDiscount, {
      cartNo,
      statementNo: 0,
      discountType: "2",
      discountValue: 40,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 通常商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeRegular2Second, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 売価変更 sales/cart/changeitemprice
    TestHelper.salesCartChangeItemPrice(step.changePrice, {
      cartNo,
      statementNo: 0,
      updatedPrice: 50000,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 超トク対象商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeSuperBargain, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SUPER_BARGAIN,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイント0倍商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodePointX0, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_X0,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 書籍 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeBookTwoTier, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.BOOK_TWO_TIER_1,
          scan_data_type: "JAN13",
        },
        {
          barcode: PROD.BOOK_TWO_TIER_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 数量限定値引 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeLimitedQuantityDiscount, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.LIMITED_QUANTITY_DISCOUNT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // まとめ値引対象商品A sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeMixMatchDiscountA, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_DISCOUNT_A,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // まとめ値引対象商品B sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeMixMatchDiscountB, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_DISCOUNT_B,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // まとめ値引対象商品C sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeMixMatchDiscountC, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_DISCOUNT_C,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 明細削除（まとめ値引対象商品B） sales/cart/deleteitem
    TestHelper.salesCartDeleteItem(step.deleteItem, {
      cartNo,
      statementNo: 10,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 年齢確認商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeAgeRestricted, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.AGE_RESTRICTED,
          scan_data_type: "Code128",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 年齢確認 sales/age-verification
    TestHelper.salesAgeVerification(step.ageVerification, {
      cartNo,
      operateEmployeeCd,
      isVerified: true,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ボーナスポイント対象商品 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeBonusPoint, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.BONUS_POINT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 株主優待 sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeShareholderBenefits, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.SHAREHOLDER_BENEFITS.CD,
          scan_data_type: "Code39",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 小計 sales/subtotal
    let totalBalanceAmount = TestHelper.salesSubtotal(step.salesSubtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    // 現金支払 sales/addpayment
    TestHelper.salesAddPayment(step.salesPayment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      totalBalanceAmount,
      details: "",
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 取引完了 sales/end
    const salesEndResponse = TestHelper.salesEnd(step.salesEnd, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    sleep(5);

    // 【返品】取引開始 refund/begin
    const refundCartInfo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(q => q.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE);

    // 【返品】小計 refund/subtotal
    const refundTotalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    // 【返品】支払登録 refund/addpayment
    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: refundTotalBalanceAmount,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 【返品】取引完了 refund/end
    const refundEndResponse = TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const refundReceiptNo = refundEndResponse.result?.receipt_no;
    const refundBusinessDay = refundEndResponse.result?.business_day;

    //3秒待機
    sleep(3);

    // Verify sales data
    const salesData = TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay: salesBusinessDay,
      receiptNo: salesReceiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.sales;

    // Verify refund data
    const refundData = TestHelper.getSalesData(step.getRefundData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay: refundBusinessDay,
      receiptNo: refundReceiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.runGroupWithoutApi(step.verifyTransactionsExist, [
      {
        res: refundData,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_sales",
            expected: true,
            actual: (res) => res.result?.sales?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_refund_sales",
            expected: true,
            actual: (res) => res.result?.refundSales?.length > 0,
          }),
        ],
      },
    ]);

    TestHelper.runGroupWithoutApi(step.verifyTransactionsValues, [
      {
        res: salesData,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data t_sales by sale receipt no: transaction is refunded",
            expected: true,
            actual: (res) => res?.some(s => s.returnedFlg === true),
          }),
        ],
      },
      {
        res: refundData,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data t_sales by refund receipt no: 以下項目が元取引の売上トランの値 × (-1)",
            expected: true,
            actual: (res) => {
              const refundData = res.result?.sales.filter(r => r.receiptNo === refundReceiptNo);
              let result = true;
              result = refundData.length === 1 && salesData?.length === 1;
              if (!result) return result;
              const refundItem = refundData?.[0];
              const salesItem = salesData?.[0];
              result = result && (refundItem?.totalQuantity === -salesItem?.totalQuantity);
              result = result && (refundItem?.totalDiscountAmount === -salesItem?.totalDiscountAmount);
              result = result && (refundItem?.totalDiscountQuantity === -salesItem?.totalDiscountQuantity);
              result = result && (refundItem?.totalSalesAmount === -salesItem?.totalSalesAmount);
              result = result && (refundItem?.taxExemptionAmount === -salesItem?.taxExemptionAmount);
              result = result && (refundItem?.totalTaxableAmount === -salesItem?.totalTaxableAmount);
              result = result && (refundItem?.totalTaxAmount === -salesItem?.totalTaxAmount);
              return result;
            },
          }),
        ],
      },
    ]);
  });
}

/**
 * @function 端末精算・開局
 * @memberof 決済
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SETTLEMENT}
 * {@link TAGS.MONEY_MANAGEMENT}
 * {@link TAGS.TERMINAL_PAYMENT}
 * {@link TAGS.OPENING}
 * {@link TAGS.REPORT_BY_TRANSACTION}
 * {@link TAGS.JOURNAL_SAVE}
 * ### テスト観点
 * * 開局トラン
 * * * ・釣銭準備金
 * * 端末管理トラン
 * * * ・前日開局日時
 * * * ・開局日時
 * * 端末精算トラン
 * * 現金在高トラン
 * * 現金在高_通貨別明細トラン
 * * 入出金トラン
 * * * ・入出金額
 * * ーーー
 * * 自動開局設定
 * * c_config:
 * * AutoOpenPermissionFlag（true: 許可）
 * * AutoOpenTimingType（1: 手動, 2: 自動）
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 端末精算 | `/settlement` |
 * | 2 | 端末精算 | `/settlement` |
 * | - | ーーー | - |
 * | - | - 2回 `/settlement` API を呼び出す理由： | - |
 * | - | 営業日の初期設定は2022-12-01 | - |
 * | ２ | 回目 API | `/settlementを呼び出すと、` |
 * | - | ・DBで保存される営業日：端末精算実行時の営業日 | - |
 * | - | ・APIのレスポンス：端末精算後、自動開局後の営業日 | - |
 * | - | 詳細は以下の資料にご参照ください： | - |
 * | - | https:`//tmnetscom.sharepoint.com/`:x:`/r/sites/ThinPOS455/Shared`%20Documents`/POS2/1_`%E8%A6%81%E4%BB%B6%E5%AE%9A%E7%BE%A9/%E3%81%9D%E3%81%AE%E4%BB%96/%23QA%E5%8F%B0%E5%B8%B3`/QA`%E5%8F%B0%E5%B8%B3_JIRA%E3%83%81%E3%82%B1%E3%83%83%E3%83%88%E5%AF%BE%E5%BF%9C%E5%A7%94.xlsx?d=waef2533242bb4e358971dc2634507398&csf=1&web=1&e=0vfkxG&nav=MTJfTzExMzpRMTE2X3tDOEY1NEMxRS0wOUM4LTREQzItQUZFNi1CNDk4MUYyNzM5RUJ9 | - |
 * 
 * ---
 * ### 前提条件
 * * \- ms_config.c_config_corporate:
 * * AutoOpenPermissionFlag (true: 許可)
 * * AutoOpenTimingType (2: 自動)
 * 
 * ---
 * ### テストデータ
 * * settlement_datetime: "2025-09-22 12:00:00"
 * * \- openPosDate = 2025-09-23 (開局日)
 * * \- lastOpenPosDate = 2025-09-22 (前日)
 * 
 * ---
 * ### 期待結果
 * * #### 2. 端末精算 `/settlement`
 * * \- settlement_receipt_no = response.receipt_no　か確認
 * * \- openPosDate = response.business_day　か確認
 * * \- lastOpenPosDate= response.before_business_day　か確認
 * * \----
 * * \- トランザクションデータは以下のテーブルに保存できたか確認する
 * * * settlement_receipt_no と openPosDateをベースに確認
 * * * \+ ms_settlement.t_open
 * * * \+ ms_settlement.t_pos_management
 * * *settlement_receipt_no と lastOpenPosDateをベースに確認
 * * * \+ ms_settlement.t_terminal_settlement
 * * * \+ ms_settlement.t_cash_balance
 * * * \+ ms_settlement.t_cash_balance_currency
 * * * \+ ms_sales.t_cash_flow
 * * * \+ ms_pos_receipt.t_ejournal
 * * \- DBのデータを確認
 * * * settlement_receipt_no と openPosDateをベースに確認
 * * * \+ ms_settlement.t_open ：１つのレコードがある
 * * \-- change_reverse_amount = 0 (チャージなし)
 * * * \+ ms_settlement.t_pos_management ：１つのレコードがある
 * * \-- open_datime = openPosDate
 * * \-- last_open_datetime = lastOpenPosDate
 * * * settlement_receipt_no と lastOpenPosDateをベースに確認
 * * * \+ ms_settlement.t_terminal_settlement ：１つのレコードがある
 * * * \+ ms_settlement.t_cash_balance ：２つのレコードがある
 * * * * \. レコード 1:
 * * \-- operation_type = 2 (端末精算)
 * * \-- cash_amount = 0 (現金実在高)
 * * \-- calc_cash_amount = 0 (現金計算上在高)
 * * \-- diff_cash_amount = cash_amount - calc_cash_amount = 0
 * * * * \.  レコード 2:
 * * \-- operation_type = 4 (売上金排出)
 * * \-- cash_amount = 0 (現金実在高)
 * * \-- calc_cash_amount = 0 (現金計算上在高)
 * * \-- diff_cash_amount = cash_amount - calc_cash_amount = 0
 * * * \+ ms_settlement.t_cash_balance_currency に20レコードがある:
 * * * * \.  レコード 1~10:
 * * \-- currency_type = 1~10 (該当 1円 ~ 10000円)
 * * \-- operation_type = 2 (端末精算)
 * * \-- drawer_cash_count = 0 (ドロア内の通貨枚数(棒金分は除く))
 * * \-- drawer_cash_amount = (通貨区分の金額 × ドロア内枚数) = 通貨区分の金額 x 0 = 0
 * * * * \.  レコード 11~20:
 * * \-- currency_type = 1~10 (該当 1円 ~ 10000円)
 * * \-- operation_type = 4 (売上金排出)
 * * \-- drawer_cash_count = 0 (ドロア内の通貨枚数(棒金分は除く))
 * * \-- drawer_cash_amount = (通貨区分の金額 × ドロア内枚数) = 通貨区分の金額 x 0 = 0
 * * * \+ ms_sales.t_cash_flow に１つのレコードがある:
 * * \-- operation_type = 10 (売上金排出)
 * * \-- amount = 0
 * * * \+ ms_pos_receipt.t_ejournal に８レコードがある
 */
export function TC_031658001_OpenAndSettleTerminal() {
  group("TC_031658001 端末精算・開局", () => {
    const step = {
      settlement1: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT, `${ENDPOINT.SETTLEMENT.desc} (1)`),
      settlement2: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT, `${ENDPOINT.SETTLEMENT.desc} (2)`),
      getSettlementData1: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_DATA_TRAN_GET_DATA, `${ENDPOINT.SETTLEMENT_DATA_TRAN_GET_DATA.desc} (1)`),
      getSettlementData2: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_DATA_TRAN_GET_DATA, `${ENDPOINT.SETTLEMENT_DATA_TRAN_GET_DATA.desc} (2)`),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA),
      getPosReceiptData: CommonFunction.getFullDesc(ENDPOINT.POS_RECEIPT_DATA_TRAN_GET_DATA),
      verifyTransactionsExist: "Verify Transactions Exist",
      verifyTransactionsValues: "Verify Transactions Values",
    };

    // Defined in master document
    // 売上金排出
    const salesCashOut = 10;
    const salesCashOutAmount = 0;
    // 端末精算
    const terminalSettlement = 2;
    // 売上金排出
    const salesCashCollect = 4;

    // Expected
    const terminalSettlementLength = 1;
    const cashBalanceCurrenciesLength = 20;
    const beforeReverseAmount = 0;

    // 端末精算 /settlement
    TestHelper.executePosSettlement(step.settlement1, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 端末精算 /settlement
    const settlement2Res = TestHelper.executePosSettlement(step.settlement2, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    const receiptNo = settlement2Res?.result?.receipt_no;
    const lastOpenPosDate = settlement2Res?.result?.before_business_day;
    const openPosDate = settlement2Res?.result?.business_day;

    sleep(5);

    // settlementData を取得
    const settlementData1Res = TestHelper.getSettlementData(step.getSettlementData1, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay: lastOpenPosDate,
      receiptNo: receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const settlementData2Res = TestHelper.getSettlementData(step.getSettlementData2, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay: openPosDate,
      receiptNo: receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // Salesdata を取得
    const salesDataDataRes = TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay: lastOpenPosDate,
      receiptNo: receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // PosReceiptData を取得
    const posReceiptDataRes = TestHelper.getPosReceiptData(step.getPosReceiptData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay: lastOpenPosDate,
      receiptNo: receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // Verify Transaction
    TestHelper.runGroupWithoutApi(step.verifyTransactionsExist, [
      {
        res: settlementData2Res,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_open",
            expected: true,
            actual: (res) => res.result?.opens?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_pos_management",
            expected: true,
            actual: (res) => res.result?.posManagements?.length > 0,
          }),
        ],
      },
      {
        res: settlementData1Res,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_terminal_settlement",
            expected: true,
            actual: (res) => res.result?.terminalSettlements?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_cash_balance",
            expected: true,
            actual: (res) => res.result?.cashBalances?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_cash_balance_currency",
            expected: true,
            actual: (res) => res.result?.cashBalanceCurrencies?.length > 0,
          }),
        ],
      },
      {
        res: salesDataDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_cash_flow",
            expected: true,
            actual: (res) => res.result?.cashFlows?.length > 0,
          }),
        ],
      },
      {
        res: posReceiptDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_ejournal",
            expected: true,
            actual: (res) => res.result?.ejournals?.length > 0,
          }),
        ],
      },
    ]);

    // Verify Database Data
    TestHelper.runGroupWithoutApi(step.verifyTransactionsValues, [
      {
        res: settlementData2Res,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data: 釣銭準備金",
            expected: beforeReverseAmount,
            actual: (res) => res.result?.opens?.[0]?.changeReserveAmount,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data: 前日開局日時 and 開局日時",
            expected: {
              lastOpenDateTime: lastOpenPosDate,
              openDateTime: openPosDate,
            },
            actual: (res) => {
              return {
                lastOpenDateTime: res.result?.posManagements?.[0]?.lastOpenDatetime.split("T")[0],
                openDateTime: res.result?.posManagements?.[0]?.openDatetime.split("T")[0],
              };
            },
          }),
        ],
      },
      {
        res: settlementData1Res,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify table t_terminal_settlement has 1 record",
            expected: terminalSettlementLength,
            actual: (res) => res.result?.terminalSettlements?.length,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data t_cash_balance operation type has 2 record",
            expected: {
              firstData: terminalSettlement,
              secondData: salesCashCollect,
            },
            actual: (res) => {
              return {
                firstData: res.result?.cashBalances?.[0]?.operationType,
                secondData: res.result?.cashBalances?.[1]?.operationType,
              };
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify t_cash_balance_currency has 20 record",
            expected: cashBalanceCurrenciesLength,
            actual: (res) => res.result?.cashBalanceCurrencies?.length,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data record 1 to record 10",
            expected: {
              operationType: true,
              drawerCashCount: true,
              drawerCashAmount: true,
            },
            actual: (res) => {
              const firstTenRecordCashBalanceCurrencies = res.result?.cashBalanceCurrencies?.slice(0, 10);
              return {
                operationType: firstTenRecordCashBalanceCurrencies.every(record => record.operationType === 2),
                drawerCashCount: firstTenRecordCashBalanceCurrencies.every(record => record.drawerCashCount === 0),
                drawerCashAmount: firstTenRecordCashBalanceCurrencies.every(record => record.drawerCashAmount === 0),
              };
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify data record 11 to record 20",
            expected: {
              operationType: true,
              drawerCashCount: true,
              drawerCashAmount: true,
            },
            actual: (res) => {
              const secondTenRecordCashBalanceCurrencies = res.result?.cashBalanceCurrencies?.slice(10);
              return {
                operationType: secondTenRecordCashBalanceCurrencies.every(record => record.operationType === 4),
                drawerCashCount: secondTenRecordCashBalanceCurrencies.every(record => record.drawerCashCount === 0),
                drawerCashAmount: secondTenRecordCashBalanceCurrencies.every(record => record.drawerCashAmount === 0),
              };
            },
          }),
        ],
      },
      {
        res: salesDataDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data t_cash_flow: 入出金額",
            expected: {
              operationType: salesCashOut,
              amount: salesCashOutAmount,
            },
            actual: (res) => {
              return {
                operationType: res.result?.cashFlows?.[0]?.operationType,
                amount: res.result?.cashFlows?.[0]?.amount,
              };
            },
          }),
        ],
      },
      {
        res: posReceiptDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify Ejournal has 8 record",
            expected: 8,
            actual: (res) => res.result?.ejournals?.length,
          }),
        ],
      },
    ]);
  });
}

/**
 * @function 現金投入
 * @memberof 金銭管理.投入
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MONEY_MANAGEMENT}
 * {@link TAGS.INPUT}
 * {@link TAGS.INSERT_ALL_BANKNOTES}
 * {@link TAGS.JOURNAL_SAVE}
 * ### テスト観点
 * * 現金在高トラン
 * * * ・現金実在高
 * * * ・現金計算上在高
 * * * ・現金過不足
 * * 現金在高_通貨別明細トラン
 * * * ・合計在高のレコード合計
 * * 入出金トラン
 * * * ・入出金額
 * * 電子ジャーナルトラン
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 |  現金投入 cash`/in` | - |
 * 
 * ---
 * ### 前提条件
 * * \- TC06の開局処理が終わった
 * 
 * ---
 * ### テストデータ
 * * {
 * *   "cash_in_type": 1,
 * *   "cash_in_info": {
 * *     "total_amount": 20,
 * *     "cash_details": [
 * *       {
 * * * *  "cash_type": 1,
 * * * *  "count": 5,
 * * * *  "priority": 0
 * *      },
 * *       {
 * * * *  "cash_type": 2,
 * * * *  "count": 3,
 * * * *  "priority": 0
 * *      }
 * *     ]
 * *  },
 * *   "actual_cash_info": {
 * *     "total_amount": 30,
 * *     "cash_details": [
 * *       {
 * * * *  "cash_type": 2,
 * * * *  "count": 2,
 * * * *  "priority": 0
 * *      },
 * *       {
 * * * *  "cash_type": 3,
 * * * *  "count": 2,
 * * * *  "priority": 0
 * *      }
 * *     ]
 * *  }
 * *}
 * 
 * ---
 * ### 期待結果
 * * ※実行結果と期待値が一致しない
 * * 以下の処理・値は間違いがあると思います。
 * * 1.  t_openにデータが保存される
 * * 2. t_terminal_settlementのデータ
 * * \----
 * * \- トランザクションは以下のテーブルに保存できたか確認する
 * * * cash_in_receipt_noをベースに確認
 * * * \+ ms_settlement.t_open
 * * * \+ ms_settlement.t_pos_management
 * * * \+ ms_settlement.t_terminal_settlement
 * * * \+ ms_settlement.t_cash_balance
 * * * \+ ms_settlement.t_cash_balance_currency
 * * * \+ ms_sales.t_cash_flow
 * * * \+ ms_pos_receipt.t_ejournal
 * * \- DBのデータを確認
 * * * cash_in_receipt_noをベースに確認
 * * * \+ ms_settlement.t_cash_balance に１つのレコードがある:
 * * \-- cash_amount = actual_cash_info.cash_details[0].cash_type (5円) x actual_cash_info.cash_details[0].count + actual_cash_info.cash_details[1].cash_type (10円) x actual_cash_info.cash_details[1].count = 5x2 +10x2=30
 * * \-- calc_cash_amount = 0
 * * \-- diff_cash_amount  = cash_amount - calc_cash_amount = 30 - 0 =30
 * * * \+ ms_settlement.t_cash_balance_currency に１０レコードがある:
 * * * * \. レコード 1
 * * \-- currency_type = 1 (1円)
 * * \-- drawer_cash_count = 0
 * * \-- drawer_cash_amount = currency_type (1円) x drawer_cash_count  = 1 x 0 = 0
 * * * * \. レコード 2:
 * * \-- currency_type = 2 (5円)
 * * \-- drawer_cash_count = actual_cash_info.cash_details[].count = 2
 * * \-- drawer_cash_amount = currency_type (5円) x drawer_cash_count  = 5 x 2 =10
 * * * * \. レコード 3:
 * * \-- currency_type = 3 (10円)
 * * \-- drawer_cash_count = actual_cash_info.cash_details[].count = 2
 * * \-- drawer_cash_amount = currency_type (10円) x drawer_cash_count = 10 x 2 = 20
 * * * * \. レコード 4:
 * * \-- currency_type = 4 (50円)
 * * \-- drawer_cash_count = 0
 * * \-- drawer_cash_amount = currency_type (50円) x drawer_cash_count = 50 x 0 = 0
 * * * * \. レコード 5:
 * * \-- currency_type = 5 (100円)
 * * \-- drawer_cash_count = 0
 * * \-- drawer_cash_amount = currency_type (100円) x drawer_cash_count = 100 x 0 = 0
 * * * * \. レコード6:
 * * \-- currency_type = 6 (500円)
 * * \-- drawer_cash_count = 0
 * * \-- drawer_cash_amount = currency_type (500円) x drawer_cash_count = 500 x 0 = 0
 * * * * \. レコード 7:
 * * \-- currency_type = 7 (1000円)
 * * \-- drawer_cash_count = 0
 * * \-- drawer_cash_amount = currency_type (1000円) x drawer_cash_count = 1000 x 0 = 0
 * * * * \. Record 8
 * * \-- currency_type = 8 (2000円)
 * * \-- drawer_cash_count = 0
 * * \-- drawer_cash_amount = currency_type (2000円) x drawer_cash_count = 2000 x 0 = 0
 * * * * \. Record 9:
 * * \-- currency_type = 9 (5000円)
 * * \-- drawer_cash_count = 0
 * * \-- drawer_cash_amount = currency_type (5000円) x drawer_cash_count = 5000 x 0 = 0
 * * * * \. Record 10:
 * * \-- currency_type = 10 (10000円)
 * * \-- drawer_cash_count = 0
 * * \-- drawer_cash_amount = currency_type (10000円) x drawer_cash_count  = 10000 x 0 = 0
 * * * \+ ms_sales.t_cash_flow に１つのレコードがある:
 * * \-- operation_type = 15 (現金全投入)
 * * \-- cash_flow_type = 1 (入金)
 * * \-- amount = cash_in_info.cash_details[0].cash_type (1円) x cash_in_info.cash_details[0].count + cash_in_info.cash_details[1].cash_type (5円) x cash_in_info.cash_details[1].count = 1x5 +5x3 = 20 (入出金区分)
 * * * \+ ms_pos_receipt.t_ejournal に１つのレコードがある:
 * * \-- journal_data に 5円       3枚,  1円       5枚, 投入合計額がある
 */
export function TC_032458001_DepositCash() {
  group("TC_032458001 現金投入", () => {
    const step = {
      cashIn: CommonFunction.getFullDesc(ENDPOINT.CASH_IN),
      getSettlementData: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_DATA_TRAN_GET_DATA),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA),
      getPosReceiptData: CommonFunction.getFullDesc(ENDPOINT.POS_RECEIPT_DATA_TRAN_GET_DATA),
      verifyTransactionsExist: "Verify Transactions Exist",
      verifyTransactionsValues: "Verify Transactions Values",
    };

    // Test data
    const cashCountCoin1 = 5; // 投入金情報 1円硬貨枚数
    const cashCountCoin5 = 3; // 投入金情報 5円硬貨枚数
    const actualCashCountCoin5 = 2; // 実在高情報 5円硬貨枚数
    const actualCashCountCoin10 = 2; // 実在高情報 10円硬貨枚数
    // 現金実在高
    const cashAmount = CASH_TYPE.COIN5.VALUE * actualCashCountCoin5 + CASH_TYPE.COIN10.VALUE * actualCashCountCoin10;
    // 釣銭準備金
    const changeReserveAmount = 0; // Specified in master t_open
    // 現金投入
    const allInsertion = 15; // Specified in master t_cash_flow
    // 入金
    const deposit = 1 // Specified in master t_cash_flow

    const cashInInfo = {
      total_amount: 20, // Test data
      cash_details: [
        {
          cash_type: CASH_TYPE.COIN1.TYPE,
          count: cashCountCoin1,
          priority: 0, // Test data
        },
        {
          cash_type: CASH_TYPE.COIN5.TYPE,
          count: cashCountCoin5,
          priority: 0, // Test data
        },
      ],
    };

    const actualCashInfo = {
      total_amount: 30, // Test data
      cash_details: [
        {
          cash_type: CASH_TYPE.COIN5.TYPE,
          count: actualCashCountCoin5,
          priority: 0, // Test data
        },
        {
          cash_type: CASH_TYPE.COIN10.TYPE,
          count: actualCashCountCoin10,
          priority: 0, // Test data
        },
      ],
    };

    const cashInResponse = TestHelper.cashIn(step.cashIn, {
      cashInInfo,
      actualCashInfo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const receiptNo = cashInResponse?.result?.receipt_no;
    const businessDay = cashInResponse?.result?.business_day?.split("T")[0];

    const settlementDataRes = TestHelper.getSettlementData(step.getSettlementData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesDataRes = TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const posReceiptDataRes = TestHelper.getPosReceiptData(step.getPosReceiptData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.runGroupWithoutApi(step.verifyTransactionsExist, [
      {
        res: settlementDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_open",
            expected: true,
            actual: (res) => res.result?.opens?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_pos_management",
            expected: true,
            actual: (res) => res.result?.posManagements?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_terminal_settlement",
            expected: true,
            actual: (res) => res.result?.terminalSettlements?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_cash_balance",
            expected: true,
            actual: (res) => res.result?.cashBalances?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_cash_balance_currency",
            expected: true,
            actual: (res) => res.result?.cashBalanceCurrencies?.length > 0,
          }),
        ],
      },
      {
        res: salesDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_cash_flow",
            expected: true,
            actual: (res) => res.result?.cashFlows?.length > 0,
          }),
        ],
      },
      {
        res: posReceiptDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_ejournal",
            expected: true,
            actual: (res) => res.result?.ejournals?.length > 0,
          }),
        ],
      },
    ]);

    TestHelper.runGroupWithoutApi(step.verifyTransactionsValues, [
      {
        res: settlementDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify record data t_cash_balance: 現金実在高, 現金計算上在高, 現金過不足",
            expected: {
              cashAmount,
              calcCashAmount: changeReserveAmount,
              diffCashAmount: cashAmount - changeReserveAmount,
            },
            actual: (res) => {
              return {
                cashAmount: res.result?.cashBalances?.[0]?.cashAmount,
                calcCashAmount: res.result?.cashBalances?.[0]?.calcCashAmount,
                diffCashAmount: res.result?.cashBalances?.[0]?.diffCashAmount,
              };
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify records data t_cash_balance_currency record 1",
            expected: getCashBalanceCurrencyExpectedData({
              currencyType: CASH_TYPE.COIN1.TYPE,
              currencyTypeValue: CASH_TYPE.COIN1.VALUE,
              drawerCashCount: 0, // 0 because actual_cash_info does not have the CASH_TYPE.COIN1.TYPE
            }),
            actual: (res) => {
              return getCashBalanceCurrencyActualData(res.result?.cashBalanceCurrencies?.[0]);
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify records data t_cash_balance_currency record 2",
            expected: getCashBalanceCurrencyExpectedData({
              currencyType: CASH_TYPE.COIN5.TYPE,
              currencyTypeValue: CASH_TYPE.COIN5.VALUE,
              drawerCashCount: actualCashCountCoin5,
            }),
            actual: (res) => {
              return getCashBalanceCurrencyActualData(res.result?.cashBalanceCurrencies?.[1]);
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify records data t_cash_balance_currency record 3",
            expected: getCashBalanceCurrencyExpectedData({
              currencyType: CASH_TYPE.COIN10.TYPE,
              currencyTypeValue: CASH_TYPE.COIN10.VALUE,
              drawerCashCount: actualCashCountCoin10,
            }),
            actual: (res) => {
              return getCashBalanceCurrencyActualData(res.result?.cashBalanceCurrencies?.[2]);
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify records data t_cash_balance_currency record 4",
            expected: getCashBalanceCurrencyExpectedData({
              currencyType: CASH_TYPE.COIN50.TYPE,
              currencyTypeValue: CASH_TYPE.COIN50.VALUE,
              drawerCashCount: 0, // 0 because actual_cash_info does not have the CASH_TYPE.COIN50.TYPE
            }),
            actual: (res) => {
              return getCashBalanceCurrencyActualData(res.result?.cashBalanceCurrencies?.[3]);
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify records data t_cash_balance_currency record 5",
            expected: getCashBalanceCurrencyExpectedData({
              currencyType: CASH_TYPE.COIN100.TYPE,
              currencyTypeValue: CASH_TYPE.COIN100.VALUE,
              drawerCashCount: 0, // 0 because actual_cash_info does not have the CASH_TYPE.COIN100.TYPE
            }),
            actual: (res) => {
              return getCashBalanceCurrencyActualData(res.result?.cashBalanceCurrencies?.[4]);
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify records data t_cash_balance_currency record 6",
            expected: getCashBalanceCurrencyExpectedData({
              currencyType: CASH_TYPE.COIN500.TYPE,
              currencyTypeValue: CASH_TYPE.COIN500.VALUE,
              drawerCashCount: 0, // 0 because actual_cash_info does not have the CASH_TYPE.COIN500.TYPE
            }),
            actual: (res) => {
              return getCashBalanceCurrencyActualData(res.result?.cashBalanceCurrencies?.[5]);
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify records data t_cash_balance_currency record 7",
            expected: getCashBalanceCurrencyExpectedData({
              currencyType: CASH_TYPE.BILL1000.TYPE,
              currencyTypeValue: CASH_TYPE.BILL1000.VALUE,
              drawerCashCount: 0, // 0 because actual_cash_info does not have the cash type CASH_TYPE.BILL1000.TYPE
            }),
            actual: (res) => {
              return getCashBalanceCurrencyActualData(res.result?.cashBalanceCurrencies?.[6]);
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify records data t_cash_balance_currency record 8",
            expected: getCashBalanceCurrencyExpectedData({
              currencyType: CASH_TYPE.BILL2000.TYPE,
              currencyTypeValue: CASH_TYPE.BILL2000.VALUE,
              drawerCashCount: 0, // 0 because actual_cash_info does not have the cash type CASH_TYPE.BILL2000.TYPE
            }),
            actual: (res) => {
              return getCashBalanceCurrencyActualData(res.result?.cashBalanceCurrencies?.[7]);
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify records data t_cash_balance_currency record 9",
            expected: getCashBalanceCurrencyExpectedData({
              currencyType: CASH_TYPE.BILL5000.TYPE,
              currencyTypeValue: CASH_TYPE.BILL5000.VALUE,
              drawerCashCount: 0, // 0 because actual_cash_info does not have the cash type CASH_TYPE.BILL5000.TYPE
            }),
            actual: (res) => {
              return getCashBalanceCurrencyActualData(res.result?.cashBalanceCurrencies?.[8]);
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify records data t_cash_balance_currency record 10",
            expected: getCashBalanceCurrencyExpectedData({
              currencyType: CASH_TYPE.BILL10000.TYPE,
              currencyTypeValue: CASH_TYPE.BILL10000.VALUE,
              drawerCashCount: 0, // 0 because actual_cash_info does not have the CASH_TYPE.BILL10000.TYPE
            }),
            actual: (res) => {
              return getCashBalanceCurrencyActualData(res.result?.cashBalanceCurrencies?.[9]);
            },
          }),
        ],
      },
      {
        res: salesDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify record data t_cash_flows: 入出金額",
            expected: {
              operationType: allInsertion,
              cashFlowType: deposit,
              amount: CASH_TYPE.COIN1.VALUE * cashCountCoin1 + CASH_TYPE.COIN5.VALUE * cashCountCoin5,
            },
            actual: (res) => {
              return {
                operationType: res.result?.cashFlows?.[0]?.operationType,
                cashFlowType: res.result?.cashFlows?.[0]?.cashFlowType,
                amount: res.result?.cashFlows?.[0]?.amount,
              };
            },
          }),
        ],
      },
      {
        res: posReceiptDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify journal_data contain data: 投入合計額",
            expected: true,
            actual: (res) => CommonFunction.includesItems([
              "5円       3枚",
              "1円       5枚",
              CASH_TYPE.COIN1.VALUE * cashCountCoin1 + CASH_TYPE.COIN5.VALUE * cashCountCoin5,
            ], res.result?.ejournals?.[0]?.journalData),
          }),
        ],
      },
    ]);
  });
}

/**
 * @function ポイント訂正
 * @memberof ポイント.Aocaポイント
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.POINT}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.JOURNAL_SAVE}
 * {@link TAGS.TAG_500_YEN_TICKET_ISSUE}
 * ### テスト観点
 * * ポイント付与トラン
 * * ポイント_TMNプリペトラン
 * * * ・ポイント付与分のレコード
 * * * ・ポイント利用分のレコード
 * * 金券_発券明細トラン
 * * 電子ジャーナルトラン
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 0 | AOKカードのポイントを0に調整 | - |
 * | 1 |  ポイント訂正開始 | `point/beginCorrection` |
 * | 2 | ポイントレシートバーコードスキャ | `point/barcode` |
 * | 3 | ポイント訂正実行 | `point/correct` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. クスリのアオキプリペイドカード: 8090227000000006
 * * 2. ポイントレシートバーコードスキャン: 61090080010009600116
 * * 3. pointAmount: 543 (ボーナスポイント)
 * * 4. point500yen: 500 (500円券)
 * 
 * ---
 * ### 期待結果
 * * #### 1. ポイント訂正開始　`point/beginCorrection`
 * *  current_point = card_info.point_count_sum
 * * #### 3. ポイント訂正実行　`point/correct`
 * *  receip_no = receipts.receipt_no
 * * ーーー
 * * \- トランザクションデータは以下のテーブルに保存できたか確認する ( receipt_noで特定):
 * * * \+ ms-sales.t_sales
 * * * \+ ms-sales.t_point
 * * * \+ ms_sales.t_point_tmn_prepaid
 * * * \+ ms_sales.t_voucher_issue_detail
 * * * \+ ms_pos_receipt.t_ejournal
 * * \- DBのデータを確認:
 * * * \+ ms_sales.t_point_tmn_prepaid に２つのレコードがある:
 * * * \*レコード1:
 * * * * statement_no= 1
 * * * * before_updated_point_count_sum = current_point
 * * * * addition_point_count_sum= pointAmount = 543
 * * * * usage_point_count_sum= 0
 * * * * updated_point_count_sum=  pointAmount = 543
 * * * \* レコード2:
 * * * *  statement_no= 2
 * * * *  before_updated_point_count_sum = pointAmount = 543
 * * * *  addition_point_count_sum= 0
 * * * *  usage_point_count_sum= point500yen = 500
 * * * *  updated_point_count_sum= pointAmount - point500yen = 543 - 500 = 43
 */
export function TC_082258001_CorrectPoint() {
  group("TC_082258001 ポイント訂正", () => {
    const step = {
      certification: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      usePoint: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_USE_POINT),
      beginPointCorrection: CommonFunction.getFullDesc(ENDPOINT.POINT_BEGIN_CORRECTION),
      pointBarcode: CommonFunction.getFullDesc(ENDPOINT.POINT_BARCODE),
      pointCorrect: CommonFunction.getFullDesc(ENDPOINT.POINT_CORRECT),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA),
      getPostReceiptData: CommonFunction.getFullDesc(ENDPOINT.POS_RECEIPT_DATA_TRAN_GET_DATA),
      verifyTransactionsExist: "Verify Transactions Exist",
      verifyTransactionsValues: "Verify Transactions Values",
    };
    const cardNo = CARD.AOKI_PREPAID.CODE;
    const receiptBarcode = "61090080010009600116";
    const pointAmount = 543;
    const pointUsedFor500Yen = 500;
    const additionPointAfterUsedFor500Yen = 0;
    const addPointStatementNo1 = 1;
    const addPointStatementNo2 = 2;
    let beforeUpdatedPoint = 0;

    // AOKカードのポイントを0に調整
    TestHelper.tmnPrepaidCertification(step.certification, [
      CHECK.createStatusCodeCheck(),
    ]);
    const usagePointCount = TestHelper.tmnPrepaidGetBalance(step.getBalance, {
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.point_count_sum;

    if (usagePointCount > 0) {
      beforeUpdatedPoint = TestHelper.settlementUsePoint(step.usePoint, {
        cardNo,
        receiptNo: receiptBarcode,
        usagePointCount,
      }, [
        CHECK.createStatusCodeCheck(),
      ]).result?.settlement_info.updated_point_count_sum;
    }

    // ポイント訂正開始 point/beginCorrection
    TestHelper.pointBeginCorrection(step.beginPointCorrection, {
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイントレシートバーコードスキャ point/barcode
    TestHelper.pointBarcode(step.pointBarcode, {
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // ポイント訂正実行 point/correct
    const pointCorrectResponse = TestHelper.pointCorrect(step.pointCorrect, {
      cardNo,
      pointAmount,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const receiptNo = pointCorrectResponse.result?.receipt_no;
    const businessDay = pointCorrectResponse.result?.business_day.split("T")[0];

    sleep(3);

    const salesDataRes = TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const posReceiptDatRes = TestHelper.getPosReceiptData(step.getPostReceiptData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.runGroupWithoutApi(step.verifyTransactionsExist, [
      {
        res: salesDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_point",
            expected: true,
            actual: (res) => res.result?.points?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_point_tmn_prepaid",
            expected: true,
            actual: (res) => res.result?.pointTmnPrepaids?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_voucher_issue_detail",
            expected: true,
            actual: (res) => res.result?.voucherIssueDetails?.length > 0,
          }),
        ],
      },
      {
        res: posReceiptDatRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_ejournal",
            expected: true,
            actual: (res) => res.result?.ejournals?.length > 0,
          }),
        ],
      },
    ]);

    TestHelper.runGroupWithoutApi(step.verifyTransactionsValues, [
      {
        res: salesDataRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data t_point_tmn_prepaid statement 1: ポイント付与分のレコード",
            expected: {
              addPointStatementNo: addPointStatementNo1,
              beforeUpdatedPointCountSum: beforeUpdatedPoint,
              additionPointCountSum: pointAmount,
              usagePointCountSum: beforeUpdatedPoint,
              updatedPointCountSum: pointAmount,
            },
            actual: (res) => {
              const pointTmnPrepaid = res.result?.pointTmnPrepaids?.[0];
              return {
                addPointStatementNo: pointTmnPrepaid?.addPointStatementNo,
                beforeUpdatedPointCountSum: pointTmnPrepaid?.beforeUpdatedPointCountSum,
                additionPointCountSum: pointTmnPrepaid?.additionPointCountSum,
                usagePointCountSum: pointTmnPrepaid?.usagePointCountSum,
                updatedPointCountSum: pointTmnPrepaid?.updatedPointCountSum,
              };
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify data t_point_tmn_prepaid statement 2: ポイント利用分のレコード",
            expected: {
              addPointStatementNo: addPointStatementNo2,
              beforeUpdatedPointCountSum: pointAmount,
              additionPointCountSum: additionPointAfterUsedFor500Yen,
              usagePointCountSum: pointUsedFor500Yen,
              updatedPointCountSum: pointAmount - pointUsedFor500Yen,
            },
            actual: (res) => {
              const pointTmnPrepaid = res.result?.pointTmnPrepaids?.[1];
              return {
                addPointStatementNo: pointTmnPrepaid?.addPointStatementNo,
                beforeUpdatedPointCountSum: pointTmnPrepaid?.beforeUpdatedPointCountSum,
                additionPointCountSum: pointTmnPrepaid?.additionPointCountSum,
                usagePointCountSum: pointTmnPrepaid?.usagePointCountSum,
                updatedPointCountSum: pointTmnPrepaid?.updatedPointCountSum,
              };
            },
          }),
        ],
      },
    ]);
  });
}

/**
 * @function チャージ・チャージ誤打訂正
 * @memberof 誤打訂正
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.POINT}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.JOURNAL_SAVE}
 * {@link TAGS.CHARGE}
 * {@link TAGS.TAG_500_YEN_TICKET_ISSUE}
 * ### テスト観点
 * * チャージトラン
 * * * ・チャージ額
 * * 誤打訂正_チャージトラン
 * * チャージ_TMNプリペトラン
 * * 入出金トラン
 * * * ・入出金額
 * * 支払トラン
 * * 支払_現金トラン
 * * ポイント付与トラン
 * * ポイント_TMNプリペトラン
 * * * ・ポイント付与分のレコード
 * * * ・ポイント利用分のレコード
 * * 金券_発券明細トラン
 * * 電子ジャーナルトラン
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 0 | AOKカードのポイントを499に調整 | - |
 * | 1 |  TMNプリペチャージ開始 tmn-prepaid`/charge/begin` | - |
 * | 2 | TMNプリペチャージ実行 tmn-prepaid`/charge` | - |
 * | 3 | 【誤打訂正】取引開始 void`/begin` | - |
 * | 4 |  【誤打訂正】TMNプリペチャージ void`/tmn-prepaid/charge` | - |
 * 
 * ---
 * ### 前提条件
 * * 500円券の発行条件を満たすには、チャージ時に、AOKカードのポイントを 497<point<499 の範囲に用意する必要があります（ms_payment.m_payment_charge_amountで1000円チャージで3ポイント加算される）。
 * 
 * ---
 * ### テストデータ
 * * 1. カード番号: 8090227000000006
 * * 2. カード種別: 27
 * * 3. 支払グループコード: 0100
 * * 4. 支払コード: 0101
 * * 5. チャージ金額: 1000
 * * 6. おつり額: 4000
 * * 7. 支払余剰額: 0
 * * 8. リジェクト金手入力額: 0
 * * 9. POSアプリ取引完了時刻: 2023-08-15
 * * 10. receiptNo: 221201008001000419 (ポイント処理用（Talendを参照）)
 * * 11. terminalId: 6408904008001 (端末ID)
 * 
 * ---
 * ### 期待結果
 * * ※　実行中に、prepaidサーバーTimeoutにより、失敗する可能性がります。
 * * #### 1. TMNプリペチャージ開始 tmn-prepaid`/charge/begin`
 * * \- beginAmount = response.value_amount_sum　か確認
 * * #### 2. TMNプリペチャージ実行 tmn-prepaid`/charge`
 * * \- charge_receipt_no = response.receipt_no　か確認
 * * #### 4. 【誤打訂正】TMNプリペチャージ void`/tmn-prepaid/charge`
 * * \- void_receipt_no = response.receipt_no　か確認
 * * \----
 * * \- トランザクションは以下のテーブルに保存できたか確認する
 * * * \+ ms_sales.t_charge (charge_receipt_no と void_receipt_noをベースに確認)
 * * * \+ ms_sales.t_void_charge (void_receipt_noをベースに確認)
 * * * \+ ms_sales.t_charge_tmn_prepaid (charge_receipt_no と void_receipt_noをベースに確認)
 * * * \+ ms_sales.t_point_tmn_prepaid (charge_receipt_no と void_receipt_noをベースに確認)
 * * \- DBのデータを確認
 * * *charge_receipt_noをベースに確認 (チャージ):
 * * * \+ ms_sales.t_charge に１つのレコードがある:
 * * \-- charge_amount = chargeAmount = 1000
 * * \-- transaction_category_type = 13 (チャージ)
 * * * \+ ms_sales.t_charge_tmn_prepaid に１つのレコードがある:
 * * \-- before_updated_value_amount_sum = beginAmount
 * * * \+ ms_sales.t_cash_flow に１つのレコードがある:
 * * \-- operation_type = 16 (チャージ)
 * * \-- cash_flow_type = 1 (入金)
 * * \-- amount = chargeAmount = 1000
 * * * \+ ms_sales.t_payment に１つのレコードがある:
 * * \-- paid_amount = chargeAmount + changeAmount = 1000 + 4000 =5000
 * * \-- change_amount = chargeAmount = 1000
 * * * \+ ms_sales.t_payment_cash に１つのレコードがある:
 * * \-- paid_amount = chargeAmount = 1000
 * * * \+ ms_sales.t_point に１つのレコードがある:
 * * \-- add_point = pointAdd = 3
 * * \-- used_point = point500yen = 500
 * * * \+ ms_sales.t_point_tmn_prepaid に２つのレコードがある:
 * * * * \. レコード 1:
 * * \-- before_updated_no_limit_value_amount_sum = beginAmount
 * * \-- addition_point_count_sum = pointAdd = 3
 * * * * \. レコード 2:
 * * \-- usage_point_count_sum = point500yen = 500
 * * * \+ ms_sales.t_voucher_issue_detail に１つのレコードがある:
 * * \-- face_value = point500yen = 500
 * * \-- issued_barcode_1 = 311. .. (20 digits - m_barcodeテーブルに定義)
 * * \-- issued_barcode_2 = 36....(20 digits - m_barcodeテーブルに定義)
 * * * \+ ms_pos_receipt.t_ejournal に２つのレコードがある
 * * *void_recepit_noをベースに確認 (返金):
 * * * \+ ms_sales.t_charge に１つのレコードがある:
 * * \-- charge_amount = -chargeAmount = -1000
 * * \-- transaction_category_type = 14(チャージ_誤打訂正)
 * * * \+ ms_sales.t_charge_tmn_prepaid に１つのレコードがある:
 * * \-- before_updated_value_amount_sum = chargeAmount + beginAmount
 * * * \+ ms_sales.t_cash_flow に１つのレコードがある:
 * * \-- operation_type = 17 (チャージ(誤打訂正))
 * * \-- cash_flow_type = 3
 * * \-- amount = -chargeAmount = -1000
 * * * \+ ms_sales.t_payment に１つのレコードがある:
 * * \-- paid_amount = -chargeAmount+ -changeAmount = -1000 + -4000 = -5000
 * * \-- change_amount = -changeAmount = -4000
 * * * \+ ms_sales.t_payment_cash に１つのレコードがある:
 * * \-- paid_amount = -chargeAmount = -1000
 * * * \+ ms_sales.t_point に１つのレコードがある:
 * * \-- add_point = -pointAdd = -3
 * * \-- used_point = -point500yen = -500
 * * * \+ ms_sales.t_point_tmn_prepaid に２つのレコードがある:
 * * * * \. レコード 1:
 * * \-- before_updated_no_limit_value_amount_sum = chargeAmount + beginAmount
 * * \-- addition_point_count_sum = point500yen = 500
 * * * * \. レコード 2:
 * * \-- usage_point_count_sum = pointAdd = 3
 * * * \+ ms_sales.t_void_charge に１つのレコードがある:
 * * \-- return_amount = chargeAmount = 1000
 * * \-- operator_name = 決済 太郎
 * * * \+ ms_pos_receipt.t_ejournal に１つのレコードがある：
 */
export function TC_072158001_ProcessTMNChargeForPrepaidPoints() {
  group("TC_072158001 チャージ", () => {
    // Precondition step to set point to 499
    const preStep = {
      generateKey: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      settlementPayment: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_PAYMENT),
      usePoint: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_USE_POINT),
      addPoint: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_ADD_POINT),
    };

    const step = {
      tmnPrepaidChargeBegin: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CHARGE_BEGIN),
      tmnPrepaidCharge: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CHARGE),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      voidTmnPrepaidCharge: CommonFunction.getFullDesc(ENDPOINT.VOID_TMN_PREPAID_CHARGE),
      getSalesDataCharge: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA, "チャージ"),
      getPosReceiptDataCharge: CommonFunction.getFullDesc(ENDPOINT.POS_RECEIPT_DATA_TRAN_GET_DATA, "チャージ"),
      getSalesDataVoid: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA, "誤打訂正_チャージ"),
      getPosReceiptDataVoid: CommonFunction.getFullDesc(ENDPOINT.POS_RECEIPT_DATA_TRAN_GET_DATA, "誤打訂正_チャージ"),
      verifyTransactionsExist: "Verify Transactions Exist",
      verifyTransactionsValues: "Verify Transactions Values",
    };

    const storeCd = ENVIRONMENT.STORE_CD;
    const posCd = ENVIRONMENT.POS_CD;
    const cardNo = CARD.AOKI_PREPAID_POINT.CODE;
    const cardType = CARD.AOKI_PREPAID_POINT.CARD_TYPE; // カード種別: Aoca. Specified in API document
    const paidGroupCode = PAID_METHOD.CASH.GROUP_CODE;
    const paidCode = PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE;
    const chargeAmount = 1000; // Test data
    const changeAmount = 4000; // Test data
    const surplusAmount = 0; // Test data
    const rejectCashAmount = 0; // Test data
    const endDatetime = "2023-08-15"; // Test data
    const terminalId = "6408904008001"; // Test data
    const pointPrecondition = 499; // Precondition data
    const pointAdd = 3; // When purchase 1000 yen, will get 3 points. Specified in master m_payment_charge_amount
    const point500yen = 500; // Point of use for issuing 500 yen coupon
    const chargeOperationType = 16; // Specified in master t_cash_flow
    const voidOperationType = 17; // Specified in master t_cash_flow
    const chargeCashFlowType = 1; // Specified in master t_cash_flow (入金) 
    const voidCashFlowType = 3; // Specified in master t_cash_flow
    const chargeTransactionCategoryType = 13; // Specified in master t_charge (チャージ)
    const voidTransactionCategoryType = 14; // Specified in master t_charge (チャージ_誤打訂正)

    // Run precondition to set Aok point equals 499
    // 認証 /tpi_v1/terminal/generatekey
    TestHelper.tmnPrepaidCertification(preStep.generateKey, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 残高照会 /tpi_v1/holder/getbalance
    const cardInfo = TestHelper.tmnPrepaidGetBalance(preStep.getBalance, {
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info;

    // Set the AOK card amount to 0 if it reaches the ceiling value
    if (cardInfo?.value_amount_sum + chargeAmount >= cardInfo?.ceiling_value_amount) {
      // バリュー利用 tpi_v1/settlement/payment
      TestHelper.settlementPayment(preStep.settlementPayment, {
        cardNo,
        usageValueAmount: cardInfo?.value_amount_sum,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    }

    const point = cardInfo?.point_count_sum;

    // If point = 499, no need to run this API
    if (point != pointPrecondition) {
      // If point = 0, no need to run this API
      if (point > 0) {
        // ポイント利用 /tpi_v1/settlement/usepoint
        TestHelper.settlementUsePoint(preStep.usePoint, {
          cardNo,
          receiptNo: ENVIRONMENT.TMN_PREPAID_RECEIPT_NO,
          usagePointCount: point,
        }, [
          CHECK.createStatusCodeCheck(),
        ]);
      };

      // ポイント付与 /tpi_v1/settlement/addpoint
      TestHelper.settlementAddPoint(preStep.addPoint, {
        cardNo,
        receiptNo: ENVIRONMENT.TMN_PREPAID_RECEIPT_NO,
        designatedExtentionLimitPointCount: pointPrecondition,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    };

    // TMNプリペチャージ開始 tmn-prepaid/charge/begin
    const beginAmount = TestHelper.tmnPrepaidChargeBegin(step.tmnPrepaidChargeBegin, {
      cardNo,
      cardType,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.customer?.value_amount_sum;

    // TMNプリペチャージ実行 tmn-prepaid/charge
    const chargeInfo = TestHelper.tmnPrepaidCharge(step.tmnPrepaidCharge, {
      cardNo,
      paidGroupCode,
      paidCode,
      chargeAmount,
      changeAmount,
      surplusAmount,
      rejectCashAmount,
      endDatetime,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.charge_info;

    sleep(3);

    const receiptNoCharge = chargeInfo?.receipt_no;
    const businessDay = chargeInfo?.business_day.substring(0, 10);

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: receiptNoCharge,
      businessDay,
      barcodeStart: ENVIRONMENT.CHARGE_RECEIPT_BARCODE_START,
    });

    // 【誤打訂正】取引開始 void/begin
    TestHelper.voidBegin(step.voidBegin, {
      terminalId,
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 【誤打訂正】TMNプリペチャージ void/tmn-prepaid/charge
    const receiptNoVoid = TestHelper.voidTmnPrepaidCharge(step.voidTmnPrepaidCharge, {
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.receipt_no;

    sleep(3);

    const salesDataChargeRes = TestHelper.getSalesData(step.getSalesDataCharge, {
      storeCd,
      posCd,
      businessDay,
      receiptNo: receiptNoCharge,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const posDataChargeRes = TestHelper.getPosReceiptData(step.getPosReceiptDataCharge, {
      storeCd,
      posCd,
      businessDay,
      receiptNo: receiptNoCharge,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesDataVoidRes = TestHelper.getSalesData(step.getSalesDataVoid, {
      storeCd,
      posCd,
      businessDay,
      receiptNo: receiptNoVoid,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const posDataVoidRes = TestHelper.getPosReceiptData(step.getPosReceiptDataVoid, {
      storeCd,
      posCd,
      businessDay,
      receiptNo: receiptNoVoid,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    // Verify Transaction
    TestHelper.runGroupWithoutApi(step.verifyTransactionsExist, [
      {
        res: salesDataChargeRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_charge of charge transaction",
            expected: true,
            actual: (res) => res.result?.charges?.length > 0,
          }),
        ],
      },
      {
        res: salesDataVoidRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_charge of void transaction",
            expected: true,
            actual: (res) => res.result?.charges?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_void_charge of void transaction",
            expected: true,
            actual: (res) => res.result?.voidCharges?.length > 0,
          }),
        ],
      },
      {
        res: salesDataChargeRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_charge_tmn_prepaid of charge transaction",
            expected: true,
            actual: (res) => res.result?.chargeTmnPrepaids?.length > 0,
          }),
        ],
      },
      {
        res: salesDataVoidRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_charge_tmn_prepaid of void transaction",
            expected: true,
            actual: (res) => res.result?.chargeTmnPrepaids?.length > 0,
          }),
        ],
      },
      {
        res: salesDataChargeRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_point_tmn_prepaid of charge transaction",
            expected: true,
            actual: (res) => res.result?.pointTmnPrepaids?.length > 0,
          }),
        ],
      },
      {
        res: salesDataVoidRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_point_tmn_prepaid of void transaction",
            expected: true,
            actual: (res) => res.result?.pointTmnPrepaids?.length > 0,
          }),
        ],
      },
    ]);

    // Verify Database Data
    TestHelper.runGroupWithoutApi(step.verifyTransactionsValues, [
      {
        res: salesDataChargeRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data is saved correctly in t_charge of charge transaction",
            expected: {
              length: 1,
              chargeAmount,
              transactionCategoryType: chargeTransactionCategoryType,
            },
            actual: (res) => ({
              length: res.result?.charges?.length,
              chargeAmount: res.result?.charges?.[0]?.charge_amount,
              transactionCategoryType: res.result?.charges?.[0]?.transaction_category_type,
            }),
          }),
          CHECK.createEqualsCheck({
            name: "Verify data is saved correctly in t_charge_tmn_prepaid of charge transaction",
            expected: {
              length: 1,
              beforeUpdatedValueAmountSum: beginAmount,
            },
            actual: (res) => ({
              length: res.result?.chargeTmnPrepaids?.length,
              beforeUpdatedValueAmountSum: res.result?.chargeTmnPrepaids?.[0]?.before_updated_value_amount_sum,
            }),
          }),
          CHECK.createEqualsCheck({
            name: "Verify data is saved correctly in t_cash_flow of charge transaction",
            expected: {
              length: 1,
              operationType: chargeOperationType,
              cashFlowType: chargeCashFlowType,
              amount: chargeAmount,
            },
            actual: (res) => ({
              length: res.result?.cashFlows?.length,
              operationType: res.result?.cashFlows?.[0]?.operationType,
              cashFlowType: res.result?.cashFlows?.[0]?.cashFlowType,
              amount: res.result?.cashFlows?.[0]?.amount,
            }),
          }),
          CHECK.createEqualsCheck({
            name: "Verify data is saved correctly in t_payment of charge transaction",
            expected: {
              length: 1,
              paidAmount: chargeAmount + changeAmount,
              changeAmount,
            },
            actual: (res) => ({
              length: res.result?.payments?.length,
              paidAmount: res.result?.payments?.[0]?.paidAmount,
              changeAmount: res.result?.payments?.[0]?.changeAmount,
            }),
          }),
          CHECK.createEqualsCheck({
            name: "Verify data is saved correctly in t_payment_cash of charge transaction",
            expected: {
              length: 1,
              paidAmount: chargeAmount,
            },
            actual: (res) => ({
              length: res.result?.paymentCashes?.length,
              paidAmount: res.result?.paymentCashes?.[0]?.paidAmount,
            }),
          }),
          CHECK.createEqualsCheck({
            name: "Verify data is saved correctly in t_point of charge transaction",
            expected: {
              length: 1,
              addPoint: pointAdd,
              usedPoint: point500yen,
            },
            actual: (res) => ({
              length: res.result?.points?.length,
              addPoint: res.result?.points?.[0]?.addPoint,
              usedPoint: res.result?.points?.[0]?.usedPoint,
            }),
          }),
          CHECK.createEqualsCheck({
            name: "Verify data is saved correctly in t_point_tmn_prepaid of charge transaction",
            expected: {
              length: 2,
              beforeUpdatedNoLimitValueAmountSum: beginAmount,
              additionPointCountSum: pointAdd,
              usagePointCountSum: point500yen,
            },
            actual: (res) => ({
              length: res.result?.pointTmnPrepaids?.length,
              beforeUpdatedNoLimitValueAmountSum: res.result?.pointTmnPrepaids?.[0]?.beforeUpdatedNoLimitValueAmountSum,
              additionPointCountSum: res.result?.pointTmnPrepaids?.[0]?.additionPointCountSum,
              usagePointCountSum: res.result?.pointTmnPrepaids?.[1]?.usagePointCountSum,
            }),
          }),
          CHECK.createEqualsCheck({
            name: "Verify data is saved correctly in t_voucher_issue_detail of charge transaction",
            expected: {
              length: 1,
              faceValue: point500yen,
              barcode1Format: true,
              barcode2Format: true,
            },
            actual: (res) => {
              const voucherIssueDetails = res.result?.voucherIssueDetails;
              const issuedBarcode1 = voucherIssueDetails?.[0]?.issuedBarcode1;
              const issuedBarcode2 = voucherIssueDetails?.[0]?.issuedBarcode2;
              return {
                length: voucherIssueDetails?.length,
                faceValue: voucherIssueDetails?.[0]?.faceValue,
                barcode1Format: issuedBarcode1?.startsWith("311") && issuedBarcode1?.length === 20,
                barcode2Format: issuedBarcode2?.startsWith("36") && issuedBarcode2?.length === 20,
              };
            },
          }),
        ],
      },
      {
        res: posDataChargeRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify 2 records data has been saved to t_ejournal of charge transaction",
            expected: 2,
            actual: (res) => res.result?.ejournals?.length,
          }),
        ],
      },
      {
        res: salesDataVoidRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data is saved correctly in t_charge of void transaction",
            expected: {
              length: 1,
              chargeAmount: chargeAmount * (-1),
              transactionCategoryType: voidTransactionCategoryType,
            },
            actual: (res) => ({
              length: res.result?.charges?.filter(q => q.cancelledFlag !== true)?.length,
              chargeAmount: res.result?.charges?.[0]?.charge_amount,
              transactionCategoryType: res.result?.charges?.[0]?.transaction_category_type,
            }),
          }),
          CHECK.createEqualsCheck({
            name: "Verify data is saved correctly in t_charge_tmn_prepaid of void transaction",
            expected: {
              length: 1,
              beforeUpdatedValueAmountSum: chargeAmount + beginAmount,
            },
            actual: (res) => ({
              length: res.result?.chargeTmnPrepaids?.length,
              beforeUpdatedValueAmountSum: res.result?.chargeTmnPrepaids?.[0]?.before_updated_value_amount_sum,
            }),
          }),
          CHECK.createEqualsCheck({
            name: "Verify data is saved correctly in t_cash_flow of void transaction",
            expected: {
              length: 1,
              operationType: voidOperationType,
              cashFlowType: voidCashFlowType,
              amount: chargeAmount * (-1),
            },
            actual: (res) => ({
              length: res.result?.cashFlows?.length,
              operationType: res.result?.cashFlows?.[0]?.operationType,
              cashFlowType: res.result?.cashFlows?.[0]?.cashFlowType,
              amount: res.result?.cashFlows?.[0]?.amount,
            }),
          }),
          CHECK.createEqualsCheck({
            name: "Verify data is saved correctly in t_payment of void transaction",
            expected: {
              length: 1,
              paidAmount: chargeAmount * (-1) + changeAmount * (-1),
              changeAmount: changeAmount * (-1),
            },
            actual: (res) => ({
              length: res.result?.payments?.length,
              paidAmount: res.result?.payments?.[0]?.paidAmount,
              changeAmount: res.result?.payments?.[0]?.changeAmount,
            }),
          }),
          CHECK.createEqualsCheck({
            name: "Verify data is saved correctly in t_payment_cash of void transaction",
            expected: {
              length: 1,
              paidAmount: chargeAmount * (-1),
            },
            actual: (res) => ({
              length: res.result?.paymentCashes?.length,
              paidAmount: res.result?.paymentCashes?.[0]?.paidAmount,
            }),
          }),
          CHECK.createEqualsCheck({
            name: "Verify data is saved correctly in t_point of void transaction",
            expected: {
              length: 1,
              addPoint: pointAdd * (-1),
              usedPoint: point500yen * (-1),
            },
            actual: (res) => ({
              length: res.result?.points?.length,
              addPoint: res.result?.points?.[0]?.addPoint,
              usedPoint: res.result?.points?.[0]?.usedPoint,
            }),
          }),
          CHECK.createEqualsCheck({
            name: "Verify data is saved correctly in t_point_tmn_prepaid of void transaction",
            expected: {
              length: 2,
              beforeUpdatedNoLimitValueAmountSum: chargeAmount + beginAmount,
              additionPointCountSum: point500yen,
              usagePointCountSum: pointAdd,
            },
            actual: (res) => ({
              length: res.result?.pointTmnPrepaids?.length,
              beforeUpdatedNoLimitValueAmountSum: res.result?.pointTmnPrepaids?.[0]?.beforeUpdatedNoLimitValueAmountSum,
              additionPointCountSum: res.result?.pointTmnPrepaids?.[1]?.additionPointCountSum,
              usagePointCountSum: res.result?.pointTmnPrepaids?.[0]?.usagePointCountSum,
            }),
          }),
          CHECK.createEqualsCheck({
            name: "Verify data is saved correctly in t_void_charge of void transaction",
            expected: {
              length: 1,
              returnAmount: chargeAmount,
              operatorName: "決済 太郎",
            },
            actual: (res) => ({
              length: res.result?.voidCharges?.length,
              returnAmount: res.result?.voidCharges?.[0]?.returnAmount,
              operatorName: res.result?.voidCharges?.[0]?.operatorName,
            }),
          }),
        ],
      },
      {
        res: posDataVoidRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify 1 record data has been saved to t_ejournal of void transaction",
            expected: 1,
            actual: (res) => res.result?.ejournals?.length,
          }),
        ],
      },
    ]);
  });
}

/**
 * @function チャージ_プリペポイント付与失敗
 * @memberof 誤打訂正
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.POINT}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.JOURNAL_SAVE}
 * {@link TAGS.CHARGE}
 * {@link TAGS.TAG_500_YEN_TICKET_ISSUE}
 * ### テスト観点
 * * ポイント処理失敗トラン
 * * * ・ポイント付与分のレコード
 * * * ・ポイント利用分のレコード
 * * ポイント処理失敗_TMNプリペトラン
 * * * ・ポイント付与分のレコード
 * * * ・ポイント利用分のレコード
 * * 金券_発券明細トラン
 * * 電子ジャーナルトラン
 * * * ・レシートxmlに、ポイントが後日反映されることが印字されている
 * * * ・500円券が発券される
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 0 | 事前準備 | - |
 * | 0.1 | プリペのポイント付与を強制的に失敗させる tmn-api-test`/set-api-timeout` | - |
 * | 0.2 | AOKカードのポイントを499に調整 | - |
 * | 0.3 | Aocaカードの残高の上限に達成すれば、Aocaカードの残高を０に設定 | - |
 * | 1 |  TMNプリペチャージ開始 | `tmn-prepaid/charge/begin` |
 * | 2 | TMNプリペチャージ実行  | `tmn-prepaid/charge` |
 * | 3 | プリペのポイント付与のタイムアウトを戻す | `tmn-api-test/set-api-timeout` |
 * | 4 |  【誤打訂正】取引開始 | `void/begin` |
 * | 5 | 【誤打訂正】TMNプリペチャージ | `void/tmn-prepaid/charge` |
 * | 5 | 後片付け | - |
 * | 5 | 1 プリペのポイント付与のタイムアウトを戻す | `tmn-api-test/set-api-timeout` |
 * 
 * ---
 * ### 前提条件
 * * \- Aocaカードのポイントを499に設定（５００円券の発券するため、チャージ時、ポイントが500より大きいのを担保）
 * * \- Aocaカードに1000円をチャージ可能を担保する
 * * 取引開始前にプリペのポイント付与を強制的に失敗させるように設定変更するAPIを呼ぶ
 * * こちらで機能実装:
 * * https:`//atlassian.tm-nets.com/bitbucket/projects/THINPOSF/repos/eshopondaprnet6/pull-requests/6967/overview`
 * * 取引完了後に設定変更を元に戻すAPIを呼ぶ
 * 
 * ---
 * ### テストデータ
 * * 0.タイムアウト設定: 
 * *     endpoint: "`/tpi_v1/settlement/addpoint`",
 * *     timeout_milliseconds: 1
 * * 1. カード番号: 8090227000000006
 * * 2. カード種別: 27
 * * 3. 支払グループコード: 0100
 * * 4. 支払コード: 0101
 * * 5. チャージ金額: 1000
 * * 6. おつり額: 4000
 * * 7. 支払余剰額: 0
 * * 8. リジェクト金手入力額: 0
 * * 9. POSアプリ取引完了時刻: 2023-08-15
 * * 10.タイムアウト設定:  
 * *   endpoint: "`/tpi_v1/settlement/addpoint`",
 * *   timeout_milliseconds: -1
 * * 11. receiptNo: 221201008001000419 (ポイント処理用（Talendを参照）)
 * * 12. terminalId: 6408904008001 (端末ID)
 * 
 * ---
 * ### 期待結果
 * * ※　実行結果と期待値が一致しない
 * * 以下の処理に間違いがあると思います。
 * * ms_sales.t_point_failure_tmn_prepaidテーブルにポイント付与（１）とポイント利用（３）のレコードがある
 * * ポイント付与（２）とポイント利用（３）が正しいと思います。
 * * #### 4. 【誤打訂正】TMNプリペチャージ void`/tmn-prepaid/charge`
 * * \- receipt_no = response.receipt_no　か確認
 * * \- トランザクションは以下のテーブルに保存できたか確認する
 * * * receipt_noをベースに確認
 * * * \+ ms_sales.t_point_failre_tmn_prepaid
 * * * \+ ms_sales.t_point_failre_tmn_prepaid_plan
 * * * \+ ms_sales.t_point_failure
 * * * \+ ms_sales.t_voucher_issue_detail
 * * * \+ ms_pos_receipt.t_ejournal
 * * \- DBのデータを確認
 * * * receipt_noをベースに確認
 * * * \+ ms_pos_receipt.t_ejournal.print_data に[翌日以降に反映されます。]がある
 * * * \+ ms_pos_receipt.t_ejournal.print_data に [５００円  お買物券] がある
 * * * \+ ms_sales.t_point_failure_tmn_prepaid に２つのレコードがある：
 * * * * \. レコード  : trade_type = 2 (ポイント与)
 * * * * \. レコード  : trade_type = 3 (ポイント利用)
 * * * \=> trade_number,trade_pos_cd　を取得
 * * * \+ ms_sales.t_point_failure に２つのレコードがある (t_point_failure_tmn_prepaidのtrade_number, trade_pos_cdをベースに確認 )
 * * * * \. レコード  : operation_kind = 1 (付与)
 * * * * \. レコード  : operation_kind = 3 (利用)
 */
export function TC_072158002_ProcessChargeFailureForPrepaidPoints() {
  group("TC_072158002 チャージ_プリペポイント付与失敗", () => {
    // Precondition step to set point to 499
    const preStep = {
      generateKey: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      usePoint: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_USE_POINT),
      addPoint: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_ADD_POINT),
      settlementPayment: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_PAYMENT),
    };

    const step = {
      tmnPrepaidChargeBegin: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CHARGE_BEGIN),
      setTimeout: CommonFunction.getFullDesc(ENDPOINT.SET_API_TIMEOUT),
      tmnPrepaidCharge: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CHARGE),
      resetTimeout: CommonFunction.getFullDesc(ENDPOINT.SET_API_TIMEOUT, `${ENDPOINT.SET_API_TIMEOUT.desc} (reset)`),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      voidTmnPrepaidCharge: CommonFunction.getFullDesc(ENDPOINT.VOID_TMN_PREPAID_CHARGE),
      getSalesDataCharge: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA),
      getPosReceiptDataCharge: CommonFunction.getFullDesc(ENDPOINT.POS_RECEIPT_DATA_TRAN_GET_DATA),
      verifyTransactionsExist: "Verify Transactions Exist",
      verifyTransactionsValues: "Verify Transactions Values",
    };

    // Defined in test data
    const cardNo = CARD.AOKI_PREPAID_POINT.CODE; // カード番号
    const cardType = CARD.AOKI_PREPAID.CARD_TYPE; // カード種別
    const paidGroupCode = PAID_METHOD.CASH.GROUP_CODE; // 支払グループコード
    const paidCode = PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE; // 支払コード
    const chargeAmount = 1000; // チャージ金額
    const changeAmount = 4000; // おつり額
    const surplusAmount = 0; // 支払余剰額
    const rejectCashAmount = 0; // リジェクト金手入力額
    const endDatetime = "2023-08-15"; // POSアプリ取引完了時刻
    const terminalId = "6408904008001"; // Confluence documentation reference
    const receiptBarcode = "221201008001000419"; // Talend reference

    // Defined in master document
    const grantPoint = 2; // ポイント与
    const usePoint = 3; // ポイント利用
    const grantOperation = 1; // 付与
    const useOperation = 3; // 利用

    let tradeNumber = null;
    let tradePosCd = null;
    let tmnPrepaidChargeRes = null;

    // 認証 /tpi_v1/terminal/generatekey
    TestHelper.tmnPrepaidCertification(preStep.generateKey, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 残高照会 /tpi_v1/holder/getbalance
    const cardInfo = TestHelper.tmnPrepaidGetBalance(preStep.getBalance, {
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info;

    // If the point value is greater than 0, this API must be called to reset it to 0
    if (cardInfo.point_count_sum > 0) {
      // ポイント利用 /tpi_v1/settlement/usepoint
      TestHelper.settlementUsePoint(preStep.usePoint, {
        cardNo,
        receiptNo: receiptBarcode,
        usagePointCount: cardInfo.point_count_sum,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    }

    // ポイント付与 tpi_v1/settlement/addpoint
    TestHelper.settlementAddPoint(preStep.addPoint, {
      cardNo,
      receiptNo: ENVIRONMENT.TMN_PREPAID_RECEIPT_NO,
      designatedExtentionLimitPointCount: 499,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // Set the AOK card amount to 0 if it reaches the ceiling value
    if (cardInfo.value_amount_sum + chargeAmount >= cardInfo.ceiling_value_amount) {
      // バリュー利用 tpi_v1/settlement/payment
      TestHelper.settlementPayment(preStep.settlementPayment, {
        usageValueAmount: cardInfo.value_amount_sum,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    }

    // TMNプリペチャージ開始 tmn-prepaid/charge/begin
    TestHelper.tmnPrepaidChargeBegin(step.tmnPrepaidChargeBegin, {
      cardNo,
      cardType,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    try {
      // Set timeout tmn-api-test/set-api-timeout
      TestHelper.setTMNServerApiTimeout(step.setTimeout, {
        endpoint: ENDPOINT.SETTLEMENT_ADD_POINT.path,
        timeoutMilliseconds: 1,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);

      // TMNプリペチャージ実行 tmn-prepaid/charge
      tmnPrepaidChargeRes = TestHelper.tmnPrepaidCharge(step.tmnPrepaidCharge, {
        cardNo,
        paidGroupCode,
        paidCode,
        chargeAmount,
        changeAmount,
        surplusAmount,
        rejectCashAmount,
        endDatetime,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    } finally {
      // Reset timeout tmn-api-test/set-api-timeout
      TestHelper.setTMNServerApiTimeout(step.resetTimeout, {
        endpoint: ENDPOINT.SETTLEMENT_ADD_POINT.path,
        timeoutMilliseconds: -1,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    }

    const chargeReceiptNo = tmnPrepaidChargeRes?.result?.charge_info.receipt_no;
    const chargeBusinessDay = tmnPrepaidChargeRes?.result?.charge_info.business_day.substring(0, 10);

    const chargeReceiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: chargeReceiptNo,
      businessDay: chargeBusinessDay,
      barcodeStart: ENVIRONMENT.CHARGE_RECEIPT_BARCODE_START,
    });

    // 【誤打訂正】取引開始 void/begin
    TestHelper.voidBegin(step.voidBegin, {
      terminalId,
      receiptBarcode: chargeReceiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 【誤打訂正】TMNプリペチャージ void/tmn-prepaid/charge
    TestHelper.voidTmnPrepaidCharge(step.voidTmnPrepaidCharge, {
      receiptBarcode: chargeReceiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesDataChargeRes = TestHelper.getSalesData(step.getSalesDataCharge, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay: chargeBusinessDay,
      receiptNo: chargeReceiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const posReceiptDataChargeRes = TestHelper.getPosReceiptData(step.getPosReceiptDataCharge, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay: chargeBusinessDay,
      receiptNo: chargeReceiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.runGroupWithoutApi(step.verifyTransactionsExist, [
      {
        res: salesDataChargeRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_point_failre_tmn_prepaid",
            expected: true,
            actual: (res) => res.result?.pointFailureTmnPrepaids?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_point_failre_tmn_prepaid_plan",
            expected: true,
            actual: (res) => res.result?.pointFailureTmnPrepaidPlans?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_point_failure",
            expected: true,
            actual: (res) => res.result?.pointFailures?.length > 0,
          }),
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_voucher_issue_detail",
            expected: true,
            actual: (res) => res.result?.voucherIssueDetails?.length > 0,
          }),
        ],
      },
      {
        res: posReceiptDataChargeRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data has been saved to t_ejournal",
            expected: true,
            actual: (res) => res.result?.ejournals?.length > 0,
          }),
        ],
      },
    ]);

    TestHelper.runGroupWithoutApi(step.verifyTransactionsValues, [
      {
        res: posReceiptDataChargeRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data t_ejournal.print_data contain [翌日以降に反映されます。]",
            expected: true,
            actual: (res) => res.result?.ejournals?.some(e => e.printData?.includes("翌日以降に反映されます。")),
          }),
          CHECK.createEqualsCheck({
            name: "Verify data t_ejournal.print_data contain [５００円  お買物券]",
            expected: true,
            actual: (res) => res.result?.ejournals?.some(e => e.printData?.match(/５００円 {2}お買物券/g)?.length > 0),
          }),
        ],
      },
      {
        res: salesDataChargeRes,
        checks: [
          CHECK.createEqualsCheck({
            name: "Verify data t_point_failre_tmn_prepaid trade_type = 2 (ポイント与)",
            expected: true,
            actual: (res) => {
              const tradeTypeGrantPoints = res.result?.pointFailureTmnPrepaids?.filter(e => e.trade_type === grantPoint);
              if (tradeTypeGrantPoints?.length > 0) {
                tradeNumber = tradeTypeGrantPoints?.[0]?.trade_number;
                tradePosCd = tradeTypeGrantPoints?.[0]?.trade_pos_cd;
              }
              return tradeTypeGrantPoints?.length > 0;
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify data t_point_failre_tmn_prepaid trade_type = 3 (ポイント利用)",
            expected: true,
            actual: (res) => {
              const tradeTypeUsePoints = res.result?.pointFailureTmnPrepaids?.filter(e => e.trade_type === usePoint);
              if (tradeTypeUsePoints?.length > 0) {
                tradeNumber = tradeTypeUsePoints?.[0]?.trade_number;
                tradePosCd = tradeTypeUsePoints?.[0]?.trade_pos_cd;
              }
              return tradeTypeUsePoints?.length > 0;
            },
          }),
          CHECK.createEqualsCheck({
            name: "Verify data t_point_failure operation_kind = 1 (付与)",
            expected: true,
            actual: (res) => res.result?.pointFailures.some(e => e.operationKind === grantOperation && e.tradeNumber === tradeNumber && e.tradePosCd === tradePosCd),
          }),
          CHECK.createEqualsCheck({
            name: "Verify data t_point_failure operation_kind = 3 (利用)",
            expected: true,
            actual: (res) => res.result?.pointFailures.some(e => e.operationKind === useOperation && e.tradeNumber === tradeNumber && e.tradePosCd === tradePosCd),
          }),
        ],
      },
    ]);
  });
}

function getCashBalanceCurrencyExpectedData({
  currencyType,
  currencyTypeValue,
  drawerCashCount,
}) {
  return {
    currencyType,
    drawerCashCount,
    drawerCashAmount: currencyTypeValue * drawerCashCount,
  };
}

function getCashBalanceCurrencyActualData(cashBalanceCurrency) {
  return {
    currencyType: cashBalanceCurrency?.currencyType,
    drawerCashCount: cashBalanceCurrency?.drawerCashCount,
    drawerCashAmount: cashBalanceCurrency?.drawerCashAmount,
  };
}
