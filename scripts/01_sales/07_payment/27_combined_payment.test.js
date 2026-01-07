import { group } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { CARD } from "../../../common/constant/card.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { Formular } from "../../../common/formular.js";
import { COUPON } from "../../../common/constant/coupon.js";
import * as TAGS from "../../../tags/tags_const.js";

// 複数の併用支払パターン
// ・クスリのアオキギフトカード（TMNプリペ）
/**
 * @function 複数の併用支払パターン
・クスリのアオキギフトカード（TMNプリペ）
・他社金券・地域振興券
 * @memberof 売上.支払
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SETTLEMENT}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.TMN_PREPAID}
 * {@link TAGS.COMBINED_USE}
 * {@link TAGS.CASH_VOUCHER}
 * {@link TAGS.MEDICINAL_AOKI_GIFT_CARD}
 * ### テスト観点
 * * 前提：
 * * * ・支払方法がm_pos_payment_patternに設定されている。
 * * * ・支払併用パターンがm_concomitant_payment_patternに設定されている。
 * * * ・以下の方法で支払う。
 * * * * →　クスリのアオキギフトカード
 * * * * ビール券
 * * * ・m_unavailable_payment_patternに商品分類パターンコード　と　支払制御パターンコードのレコードがない商品と支払を利用する。
 * * * 合計が3000円以上が望ましい（併用支払が可能な合計金額が望ましい）
 * * テスト観点：
 * * １取引内で現金を含むない複数の支払方法が併用できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | ポイント付与専用商品（対象外）スキャン | `/sales/cart/barcode` |
 * | 3 | 通常商品 スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/tmn-prepaid/value` |
 * | 6 | 支払登録 | `/sales/cart/voucher` |
 * | 7 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.ポイント付与専用商品（対象外）: 4911110703005 (unit_price: 3069)
 * * 2.通常商品 : 4500000000121 (unit_price: 400)
 * * 3.クスリのアオキギフトカード: 8308891100000030
 * * 4.ビール・清酒券 : 
 * * * \+ voucher_code: "0611"
 * 
 * ---
 * ### 期待結果
 * * #### 4. 小計 `/sales/subtotal`
 * * カート情報に2つの商品が登録されていることを確認する
 * * * \+ ポイント付与専用商品（対象外）バーコード: 4911110703005
 * * * \+ 通常商品 バーコード: 4500000000121
 * * * \+ total_balance_amount = 3807
 * * #### 5. 支払登録 `/tmn-prepaid/value`
 * * * \+ total_balance_amount: 2000
 * * * \+ ギフト支払に以下が含まれていること
 * * * * ・paid_cd = "0996"  
 * * * * ・paid_name = "ギフト"  
 * * * * ・paid_amount = 1807  
 * * #### 6. 支払登録 `/sales/cart/voucher`
 * * * \+ total_balance_amount: 0
 * * * \+ ビール・清酒券支払に以下が含まれていること
 * * * * ・voucher_cd = "0611"  
 * * * * ・voucher_name = "ビール・清酒券"  
 * * * * ・paid_amount = 2000  
 * * #### 7. 取引完了 `/sales/end`
 * * * レシートが正しく印字され、2種類の支払方法（ギフト、ビール・清酒券）の情報が含まれていることを確認する。
 */
export function TC_010727002_MultiplePaymentWithoutCash() {
  group("TC_010727002 複数の併用支払パターン", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeDedicatedPointGrantExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント付与専用商品（対象外）スキャン"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品 スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      certification: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      deposit: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_DEPOSIT),
      tmnPrepaidValue: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_VALUE),
      voucher: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_VOUCHER),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const cardNo = CARD.AOKI_GIFT.CODE;
    const giftCardAmount = 1807; //test data (Used an Aoki gift card worth 1807; combined with a beer voucher, it was sufficient to pay the bill)
    const voucherAmount = 2000; //test data (Paid with a Beer voucher valued at 2000)
    let totalBalanceAmount = 0;

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.ポイント付与専用商品（対象外）スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeDedicatedPointGrantExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DEDICATED_POINT_GRANT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 3.通常商品 スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeRegular, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 4.小計 /sales/subtotal
    totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify items length equals 2",
        expected: 2,
        actual: (res) => res.result?.cartinfo?.items?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 2 scanned items: ポイント付与専用商品 (対象外), 通常商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.DEDICATED_POINT_GRANT_EXCLUDE,
          PROD.REGULAR,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 5.支払登録 /tmn-prepaid/value
    TestHelper.tmnPrepaidCertification(step.certification, [
      CHECK.createStatusCodeCheck(),
    ]);

    const balance = TestHelper.tmnPrepaidGetBalance(step.getBalance, {
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.value_amount_sum;

    if (balance < giftCardAmount) {
      TestHelper.tmnPrepaidDeposit(step.deposit, {
        cardNo,
        receiptNo: ENVIRONMENT.TMN_PREPAID_RECEIPT_NO,
        chargeValueAmount: giftCardAmount,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    }

    totalBalanceAmount = TestHelper.tmnPrepaidValue(step.tmnPrepaidValue, {
      cartNo,
      paidCodes: [
        PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_CODE,
      ],
      paidAmount: giftCardAmount,
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount after Gift card payment",
        expected: totalBalanceAmount - giftCardAmount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify Gift card payment has been applied",
        expected: {
          paidCd: PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_CODE,
          paidName: PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_NAME,
          paidAmount: giftCardAmount,
        },
        actual: (res) => {
          const giftCardPayment = res.result?.cartinfo?.payments?.find(payment => payment.paid_cd === PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_CODE);
          return {
            paidCd: giftCardPayment?.paid_cd,
            paidName: giftCardPayment?.paid_name,
            paidAmount: giftCardPayment?.paid_amount,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 6.支払登録 /sales/cart/voucher
    TestHelper.salesCartVoucher(step.voucher, {
      cartNo,
      voucherCode: COUPON.BEER_VOUCHER.CD,
      voucherBalanceAmount: voucherAmount,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount after Beer voucher payment",
        expected: totalBalanceAmount - voucherAmount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify Beer voucher payment has been applied",
        expected: {
          voucherCd: COUPON.BEER_VOUCHER.CD,
          voucherName: COUPON.BEER_VOUCHER.NAME,
          paidAmount: voucherAmount,
        },
        actual: (res) => {
          const voucherPayment = res.result?.cartinfo?.payments?.find(payment => payment.voucher_cd === COUPON.BEER_VOUCHER.CD);
          return {
            voucherCd: voucherPayment?.voucher_cd,
            voucherName: voucherPayment?.voucher_name,
            paidAmount: voucherPayment?.paid_amount,
          };
        },
      }),
    ]);

    // 7.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt data must contain 2 scanned items",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.DEDICATED_POINT_GRANT_EXCLUDE,
          PROD.REGULAR,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
      CHECK.createEqualsCheck({
        name: "Receipt data must contain 2 payment methods",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_NAME,
          COUPON.BEER_VOUCHER.NAME,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);
  });
}

// 複数の併用支払パターン
// ・現金
// ・クスリのアオキギフトカード（TMNプリペ）
/**
 * @function 複数の併用支払パターン
・現金
・クスリのアオキギフトカード（TMNプリペ）
・他社金券・地域振興券
 * @memberof 売上.支払
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SETTLEMENT}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.TMN_PREPAID}
 * {@link TAGS.COMBINED_USE}
 * {@link TAGS.CASH}
 * {@link TAGS.CASH_VOUCHER}
 * {@link TAGS.MEDICINAL_AOKI_GIFT_CARD}
 * ### テスト観点
 * * 前提：
 * * * ・支払方法がm_pos_payment_patternに設定されている。
 * * * ・支払併用パターンがm_concomitant_payment_patternに設定されている。
 * * * ・以下の方法で支払う。
 * * * * →　クスリのアオキギフトカード
 * * * * ビール券
 * * * ・m_unavailable_payment_patternに商品分類パターンコード　と　支払制御パターンコードのレコードがない商品と支払を利用する。
 * * * 合計が3000円以上が望ましい（併用支払が可能な合計金額が望ましい）
 * * テスト観点：
 * * １取引内で現金を含む複数の支払方法が併用できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | ポイント付与専用商品（対象外） スキャン | `/sales/cart/barcode` |
 * | 3 | 通常商品 スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/tmn-prepaid/value` |
 * | 6 | 支払登録 | `/sales/cart/voucher` |
 * | 7 | 支払登録 | `/sales/addpayment` |
 * | 8 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.ポイント付与専用商品（対象外）: 4911110703005 (unit_price: 3069)
 * * 2.通常商品 : 4500000000121 (unit_price: 400)
 * * 3.クスリのアオキギフトカード: 8308891100000030
 * * 4.ビール・清酒券 : 
 * * * \+ voucher_code: "0611"
 * 
 * ---
 * ### 期待結果
 * * #### 4. 小計 `/sales/subtotal`
 * * カート情報に2つの商品が登録されていることを確認する：
 * * * \+ ポイント付与専用商品（対象外） バーコード: 4911110703005
 * * * \+ 通常商品 バーコード: 4500000000121
 * * * \+ total_balance_amount = 3807
 * * #### 5. 支払登録 `/tmn-prepaid/value`
 * * * \+ total_balance_amount: 3000
 * * * \+ ギフト支払に以下が含まれていること
 * * * * ・paid_cd = "0996"  
 * * * * ・paid_name = "ギフト"  
 * * * * ・paid_amount = 807  
 * * #### 6. 支払登録 `/sales/cart/voucher`
 * * * \+ total_balance_amount: 1000
 * * * \+ ビール・清酒券支払に以下が含まれていること
 * * * * ・voucher_cd = "0611"  
 * * * * ・voucher_name = "ビール・清酒券"  
 * * * * ・paid_amount = 2000  
 * * #### 7. 支払登録 `/sales/addpayment`
 * * * \+ total_balance_amount: 0
 * * * \+ 現金支払に以下が含まれていること
 * * * * ・paid_cd = "0102"  
 * * * * ・paid_name = "現金"  
 * * * * ・paid_amount = 1000  
 * * #### 8. 取引完了 `/sales/end`
 * * * レシートが正しく印字され、3種類の支払方法（ギフト、ビール・清酒券、現金）の情報が含まれていることを確認する。
 */
export function TC_010727001_MultiplePaymentWithCash() {
  group("TC_010727001 複数の併用支払パターン", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeDedicatedPointGrantExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント付与専用商品（対象外）スキャン"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品 スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      certification: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      deposit: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_DEPOSIT),
      tmnPrepaidValue: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_VALUE),
      voucher: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_VOUCHER),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const cardNo = CARD.AOKI_GIFT.CODE;
    const giftCardAmount = 807; //test data (Paid with a Aoki gift card valued at 807)
    const voucherAmount = 2000; //test data (Paid with a Beer voucher valued at 2000)
    let totalBalanceAmount = 0;

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.ポイント付与専用商品（対象外） スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeDedicatedPointGrantExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DEDICATED_POINT_GRANT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 3.通常商品 スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeRegular, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 4.小計 /sales/subtotal
    totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify items length equals 2",
        expected: 2,
        actual: (res) => res.result?.cartinfo?.items?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 2 scanned items: ポイント付与専用商品 (対象外), 通常商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.DEDICATED_POINT_GRANT_EXCLUDE,
          PROD.REGULAR,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 5.支払登録 /tmn-prepaid/value
    TestHelper.tmnPrepaidCertification(step.certification, [
      CHECK.createStatusCodeCheck(),
    ]);

    const balance = TestHelper.tmnPrepaidGetBalance(step.getBalance, {
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.value_amount_sum;

    if (balance < giftCardAmount) {
      TestHelper.tmnPrepaidDeposit(step.deposit, {
        cardNo,
        receiptNo: ENVIRONMENT.TMN_PREPAID_RECEIPT_NO,
        chargeValueAmount: giftCardAmount,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    }

    totalBalanceAmount = TestHelper.tmnPrepaidValue(step.tmnPrepaidValue, {
      cartNo,
      paidCodes: [
        PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_CODE,
      ],
      paidAmount: giftCardAmount,
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount after Gift card payment",
        expected: totalBalanceAmount - giftCardAmount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify Gift card payment has been applied",
        expected: {
          paidCd: PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_CODE,
          paidName: PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_NAME,
          paidAmount: giftCardAmount,
        },
        actual: (res) => {
          const giftCardPayment = res.result?.cartinfo?.payments?.find(p => p.paid_cd === PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_CODE);
          return {
            paidCd: giftCardPayment?.paid_cd,
            paidName: giftCardPayment?.paid_name,
            paidAmount: giftCardPayment?.paid_amount,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 6.支払登録 /sales/cart/voucher
    totalBalanceAmount = TestHelper.salesCartVoucher(step.voucher, {
      cartNo,
      voucherCode: COUPON.BEER_VOUCHER.CD,
      voucherBalanceAmount: voucherAmount,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount after Beer voucher payment",
        expected: totalBalanceAmount - voucherAmount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify Beer voucher payment has been applied",
        expected: {
          voucherCd: COUPON.BEER_VOUCHER.CD,
          voucherName: COUPON.BEER_VOUCHER.NAME,
          paidAmount: voucherAmount,
        },
        actual: (res) => {
          const beerVoucherPayment = res.result?.cartinfo?.payments?.find(p => p.voucher_cd === COUPON.BEER_VOUCHER.CD);
          return {
            voucherCd: beerVoucherPayment?.voucher_cd,
            voucherName: beerVoucherPayment?.voucher_name,
            paidAmount: beerVoucherPayment?.paid_amount,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 7.支払登録 /sales/addpayment
    const cashAmount = totalBalanceAmount;
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
      totalBalanceAmount: cashAmount,
      details: "",
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount after Cash payment",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify Cash payment has been applied",
        expected: {
          paidCd: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
          paidName: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_NAME,
          paidAmount: cashAmount,
        },
        actual: (res) => {
          const cashPayment = res.result?.cartinfo?.payments?.find(p => p.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE);
          return {
            paidCd: cashPayment?.paid_cd,
            paidName: cashPayment?.paid_name,
            paidAmount: cashPayment?.paid_amount,
          };
        },
      }),
    ]);

    // 8.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt data must contain 2 scanned items",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.DEDICATED_POINT_GRANT_EXCLUDE,
          PROD.REGULAR,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
      CHECK.createEqualsCheck({
        name: "Receipt data must contain 3 payment methods",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_NAME,
          COUPON.BEER_VOUCHER.NAME,
          PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_NAME,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);
  });
}
